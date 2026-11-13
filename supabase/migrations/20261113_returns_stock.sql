-- Outfit Shop: devoluciones completas de renglón y stock de prendas recuperadas.
-- IMPORTANTE: aplicar en un entorno de prueba antes de producción.
-- Los montos se expresan en centavos enteros.
create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  item_index integer not null,
  item_snapshot jsonb not null,
  quantity integer not null check(quantity > 0),
  refund_value bigint not null check(refund_value >= 0),
  credit_to_resolve bigint not null default 0 check(credit_to_resolve >= 0),
  reason text not null check(length(trim(reason)) between 3 and 500),
  disposition text not null check(disposition in ('STOCK', 'NO_APTO')),
  created_at timestamptz not null default now(),
  constraint nonnegative_item_index check (item_index >= 0)
);

create table if not exists public.returned_stock (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null unique references public.order_returns(id) on delete restrict,
  product_name text not null,
  size text,
  color text,
  unit_price bigint not null check(unit_price >= 0),
  unit_cost bigint not null default 0 check(unit_cost >= 0),
  quantity integer not null check(quantity > 0),
  status text not null default 'DISPONIBLE' check(status in ('DISPONIBLE', 'VENDIDO')),
  sold_order_id uuid references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint sold_requires_order check ((status = 'DISPONIBLE' and sold_order_id is null) or (status = 'VENDIDO' and sold_order_id is not null))
);

create index if not exists returned_stock_status_idx on public.returned_stock (status, created_at desc);
create index if not exists order_returns_customer_idx on public.order_returns (customer_id, created_at desc);

-- Política de acceso: se utilizan los permisos y reglas de la app existente.
-- Nunca ejecutar esta función como SECURITY DEFINER.
create or replace function public.register_order_return(
  p_order_id uuid,
  p_item_index integer,
  p_expected_item_id text,
  p_reason text,
  p_disposition text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
  v_item jsonb;
  v_qty integer;
  v_price bigint;
  v_amount bigint;
  v_new_total bigint;
  v_credit bigint;
  v_return_id uuid;
  v_stock_name text;
begin
  if p_item_index is null or p_item_index < 0 or
     trim(coalesce(p_reason,'')) !~ '.{3}' or length(trim(p_reason)) > 500 or
     p_disposition not in ('STOCK','NO_APTO') then
    raise exception 'Datos de devolución inválidos';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if upper(v_order.status) in ('CANCELADO','ANULADO') then
    raise exception 'El pedido ya está anulado';
  end if;
  if jsonb_typeof(v_order.items::jsonb) <> 'array' then
    raise exception 'Este pedido histórico no tiene items individuales';
  end if;
  v_items := v_order.items::jsonb;
  if p_item_index >= jsonb_array_length(v_items) then
    raise exception 'La prenda ya no figura en el pedido';
  end if;

  v_item := v_items -> p_item_index;
  if coalesce(v_item->>'id','') = '' then
    raise exception 'Esta prenda histórica no tiene identificador; requiere revisión manual';
  end if;
  if coalesce(v_item->>'id','') <> coalesce(p_expected_item_id,'') then
    raise exception 'La lista cambió desde que abriste el pedido: actualizá y reintentá';
  end if;
  v_qty := greatest(1, coalesce(nullif(v_item->>'quantity','')::integer, 1));
  v_price := coalesce(nullif(v_item->>'unitPrice','')::bigint, 0);
  v_amount := v_qty * v_price;
  if v_amount <= 0 or v_amount > v_order.total_amount then
    raise exception 'Precio del item inválido: requiere revisión manual';
  end if;

  -- No convertir una compra aún pendiente en supuesto stock físico.
  if exists (
    select 1 from public.pending_purchases pp
    where pp.order_id = p_order_id
      and pp.item_id::text = v_item->>'id'
      and pp.status = 'PENDIENTE'
  ) then
    raise exception 'Primero confirmá la recepción de la prenda en Compras Pendientes';
  end if;

  v_new_total := v_order.total_amount - v_amount;
  v_credit := greatest(0, coalesce(v_order.advance_payment,0) - v_new_total)
            - greatest(0, coalesce(v_order.advance_payment,0) - v_order.total_amount);
  v_stock_name := coalesce(nullif(trim(v_item->>'productName'),''), nullif(trim(v_item->>'description'),''), 'Prenda sin nombre');

  insert into public.order_returns
    (order_id, customer_id, item_index, item_snapshot, quantity, refund_value, credit_to_resolve, reason, disposition)
  values
    (p_order_id, v_order.customer_id, p_item_index, v_item, v_qty, v_amount, v_credit, trim(p_reason), p_disposition)
  returning id into v_return_id;

  -- Mantener renglones restantes y sus índices originales en un JSONB separado
  -- (una segunda devolución debe seleccionar el índice actual en la ficha).
  v_items := v_items - p_item_index;
  update public.orders
  set items = v_items, total_amount = v_new_total
  where id = p_order_id;

  if p_disposition = 'STOCK' then
    insert into public.returned_stock
      (return_id, product_name, size, color, unit_price, unit_cost, quantity)
    values
      (v_return_id, v_stock_name, v_item->>'size', v_item->>'color', v_price,
       greatest(0,coalesce(nullif(v_item->>'wholesaleCost','')::bigint,0)), v_qty);
  end if;
  return v_return_id;
end;
$$;

-- No marcar una prenda vendida sin un pedido real que la respalde.
create or replace function public.mark_returned_stock_sold(p_stock_id uuid, p_sold_order_id uuid)
returns void
language plpgsql security invoker set search_path = public
as $$
declare v_stock public.returned_stock%rowtype; v_order public.orders%rowtype;
begin
  select * into v_stock from public.returned_stock where id = p_stock_id for update;
  if not found or v_stock.status <> 'DISPONIBLE' then
    raise exception 'La prenda ya no está disponible';
  end if;
  select * into v_order from public.orders where id = p_sold_order_id;
  if not found or upper(v_order.status) in ('CANCELADO','ANULADO') then
    raise exception 'El pedido destino no existe o está anulado';
  end if;
  if v_order.id = (select order_id from public.order_returns where id = v_stock.return_id) then
    raise exception 'No se puede revender al pedido original';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_order.items::jsonb,'[]'::jsonb)) i
    where i->>'sourceReturnStockId' = p_stock_id::text
  ) then
    raise exception 'El pedido destino no identifica esta prenda de stock: no se puede vincular';
  end if;
  update public.returned_stock set status='VENDIDO', sold_order_id=p_sold_order_id where id=p_stock_id;
end;
$$;

grant select, insert on public.order_returns to anon, authenticated;
grant select, insert on public.returned_stock to anon, authenticated;
grant execute on function public.register_order_return(uuid, integer, text, text, text) to anon, authenticated;
grant execute on function public.mark_returned_stock_sold(uuid, uuid) to anon, authenticated;
