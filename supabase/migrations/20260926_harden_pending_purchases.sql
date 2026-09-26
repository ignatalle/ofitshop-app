-- Auditoría 2026: endurecer Compras Pendientes.
-- 1) Resolver compra deja el snapshot histórico marcado como comprado/pagado.
-- 2) Bloquea compras de pedidos cancelados/anulados.
-- 3) Asignar proveedor actualiza pending_purchases + orders.items en una sola transacción.

CREATE OR REPLACE FUNCTION public.resolve_pending_purchase_with_payment(
  p_purchase_id uuid,
  p_cost_price bigint,
  p_cuenta text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item_id text;
  v_product_name text;
  v_supplier_name text;
  v_quantity integer;
  v_status text;
  v_order_status text;
  v_items jsonb;
  v_index integer;
  v_match_count integer;
  v_total_cost bigint;
  v_description text;
  v_item jsonb;
BEGIN
  IF p_cost_price IS NULL OR p_cost_price <= 0 THEN
    RAISE EXCEPTION 'El costo real por unidad debe ser mayor a 0';
  END IF;

  p_cuenta := UPPER(COALESCE(p_cuenta, ''));
  IF p_cuenta NOT IN ('EFECTIVO', 'VIRTUAL') THEN
    RAISE EXCEPTION 'La cuenta debe ser EFECTIVO o VIRTUAL';
  END IF;

  SELECT
    pp.order_id,
    pp.item_id,
    pp.product_name,
    pp.supplier_name,
    pp.quantity,
    pp.status
  INTO
    v_order_id,
    v_item_id,
    v_product_name,
    v_supplier_name,
    v_quantity,
    v_status
  FROM public.pending_purchases pp
  WHERE pp.id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra pendiente inexistente';
  END IF;

  IF v_status <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'La compra ya fue resuelta';
  END IF;

  SELECT o.items, UPPER(COALESCE(o.status, ''))
  INTO v_items, v_order_status
  FROM public.orders o
  WHERE o.id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el pedido original';
  END IF;

  IF v_order_status IN ('CANCELADO', 'ANULADO') THEN
    RAISE EXCEPTION 'No se puede comprar mercaderia para un pedido cancelado o anulado';
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'El pedido original no contiene items validos';
  END IF;

  SELECT count(*), min((j.ord - 1)::integer)
  INTO v_match_count, v_index
  FROM jsonb_array_elements(v_items) WITH ORDINALITY AS j(elem, ord)
  WHERE j.elem ->> 'id' = v_item_id;

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'No se encontro exactamente un item historico';
  END IF;

  v_quantity := GREATEST(COALESCE(v_quantity, 1), 1);
  v_total_cost := p_cost_price * v_quantity;
  v_supplier_name := COALESCE(NULLIF(BTRIM(v_supplier_name), ''), 'Sin proveedor');
  v_product_name := COALESCE(NULLIF(BTRIM(v_product_name), ''), 'Producto');
  v_description := '[MERCADERIA] Compra a ' || v_supplier_name || ' - ' ||
    v_product_name || ' (' || v_quantity::text || 'x)';

  -- Primero preservamos la fila como historia resuelta. Así el trigger de
  -- sincronización no la borra cuando needsPurchase pasa a false.
  UPDATE public.pending_purchases
  SET
    status = 'CONSEGUIDO',
    cost_price = p_cost_price,
    resolved_at = now(),
    updated_at = now()
  WHERE id = p_purchase_id;

  v_item := v_items -> v_index;
  v_item := v_item || jsonb_build_object(
    'wholesaleCost', p_cost_price,
    'costCents', p_cost_price,
    'needsPurchase', false,
    'costPaid', true,
    'costAccount', p_cuenta
  );

  v_items := jsonb_set(
    v_items,
    ARRAY[v_index::text],
    v_item,
    false
  );

  UPDATE public.orders
  SET items = v_items
  WHERE id = v_order_id;

  INSERT INTO public.transactions (
    order_id,
    type,
    amount,
    description,
    cuenta
  )
  VALUES (
    v_order_id,
    'EGRESO',
    v_total_cost,
    v_description,
    p_cuenta
  );
END;
$$;

GRANT EXECUTE
ON FUNCTION public.resolve_pending_purchase_with_payment(uuid, bigint, text)
TO anon;


CREATE OR REPLACE FUNCTION public.assign_pending_purchase_supplier_atomic(
  p_purchase_id uuid,
  p_supplier_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_name text;
  v_supplier_id uuid;
  v_supplier_saved_name text;
  v_order_id uuid;
  v_item_id text;
  v_status text;
  v_items jsonb;
  v_index integer;
  v_match_count integer;
  v_item jsonb;
BEGIN
  v_clean_name := NULLIF(BTRIM(COALESCE(p_supplier_name, '')), '');

  SELECT pp.order_id, pp.item_id, pp.status
  INTO v_order_id, v_item_id, v_status
  FROM public.pending_purchases pp
  WHERE pp.id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra pendiente inexistente';
  END IF;

  IF v_status <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'Solo se puede cambiar proveedor en una compra pendiente';
  END IF;

  IF v_clean_name IS NOT NULL THEN
    SELECT s.id, s.name
    INTO v_supplier_id, v_supplier_saved_name
    FROM public.suppliers s
    WHERE LOWER(BTRIM(s.name)) = LOWER(v_clean_name)
    ORDER BY s.id
    LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO public.suppliers (name)
      VALUES (v_clean_name)
      RETURNING id, name INTO v_supplier_id, v_supplier_saved_name;
    END IF;
  ELSE
    v_supplier_id := NULL;
    v_supplier_saved_name := NULL;
  END IF;

  SELECT o.items
  INTO v_items
  FROM public.orders o
  WHERE o.id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el pedido original';
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'El pedido original no contiene items validos';
  END IF;

  SELECT count(*), min((j.ord - 1)::integer)
  INTO v_match_count, v_index
  FROM jsonb_array_elements(v_items) WITH ORDINALITY AS j(elem, ord)
  WHERE j.elem ->> 'id' = v_item_id;

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'No se encontro exactamente un item historico';
  END IF;

  v_item := v_items -> v_index;
  v_item := v_item || jsonb_build_object(
    'supplierId', v_supplier_id,
    'supplierName', v_supplier_saved_name
  );

  v_items := jsonb_set(
    v_items,
    ARRAY[v_index::text],
    v_item,
    false
  );

  -- El trigger de sync_pending_purchases mantiene ambos lados alineados.
  UPDATE public.orders
  SET items = v_items
  WHERE id = v_order_id;

  UPDATE public.pending_purchases
  SET
    supplier_id = v_supplier_id,
    supplier_name = v_supplier_saved_name,
    updated_at = now()
  WHERE id = p_purchase_id;

  RETURN jsonb_build_object(
    'supplier_id', v_supplier_id,
    'supplier_name', v_supplier_saved_name
  );
END;
$$;

GRANT EXECUTE
ON FUNCTION public.assign_pending_purchase_supplier_atomic(uuid, text)
TO anon;
