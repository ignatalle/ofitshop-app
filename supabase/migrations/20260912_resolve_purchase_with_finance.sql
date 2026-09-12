-- Fase 4: al marcar una compra como CONSEGUIDO también registrar la salida real de caja.
-- Todo ocurre en una sola transacción PostgreSQL.

CREATE OR REPLACE FUNCTION public.resolve_pending_purchase_with_payment(
  p_purchase_id uuid,
  p_cost_price bigint,
  p_cuenta text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_order_id uuid;
  v_item_id text;
  v_product_name text;
  v_supplier_name text;
  v_quantity integer;
  v_status text;
  v_items jsonb;
  v_index integer;
  v_found integer := 0;
  v_total_cost bigint;
  v_description text;
BEGIN
  IF p_cost_price IS NULL OR p_cost_price <= 0 THEN
    RAISE EXCEPTION 'El costo real por unidad debe ser mayor a 0';
  END IF;

  IF p_cuenta IS NULL OR p_cuenta NOT IN ('EFECTIVO', 'VIRTUAL') THEN
    RAISE EXCEPTION 'La cuenta debe ser EFECTIVO o VIRTUAL';
  END IF;

  SELECT order_id, item_id, product_name, supplier_name, quantity, status
    INTO v_order_id, v_item_id, v_product_name, v_supplier_name, v_quantity, v_status
    FROM public.pending_purchases
   WHERE id = p_purchase_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra pendiente inexistente';
  END IF;

  IF v_status <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'La compra ya fue resuelta con estado %', v_status;
  END IF;

  SELECT items
    INTO v_items
    FROM public.orders
   WHERE id = v_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el pedido original';
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'El pedido original no contiene una lista de items valida';
  END IF;

  IF jsonb_array_length(v_items) > 0 THEN
    FOR v_index IN 0..jsonb_array_length(v_items) - 1 LOOP
      IF v_items->v_index->>'id' = v_item_id THEN
        v_found := v_found + 1;
        v_items := jsonb_set(
          v_items,
          ARRAY[v_index::text, 'wholesaleCost'],
          to_jsonb(p_cost_price),
          true
        );
      END IF;
    END LOOP;
  END IF;

  IF v_found <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 item historico y se encontraron %', v_found;
  END IF;

  UPDATE public.orders
     SET items = v_items
   WHERE id = v_order_id;

  v_quantity := GREATEST(1, COALESCE(v_quantity, 1));
  v_total_cost := p_cost_price * v_quantity;
  v_supplier_name := COALESCE(NULLIF(btrim(v_supplier_name), ''), 'Sin proveedor');
  v_product_name := COALESCE(NULLIF(btrim(v_product_name), ''), 'Producto');

  v_description := '[MERCADERIA] Compra a ' || v_supplier_name || ' - ' ||
                   v_product_name || ' (' || v_quantity::text || 'x)';

  INSERT INTO public.transactions (
    order_id,
    "type",
    amount,
    description,
    cuenta
  ) VALUES (
    v_order_id,
    'EGRESO',
    v_total_cost,
    v_description,
    p_cuenta
  );

  UPDATE public.pending_purchases
     SET status = 'CONSEGUIDO',
         cost_price = p_cost_price,
         resolved_at = now(),
         updated_at = now()
   WHERE id = p_purchase_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.resolve_pending_purchase_with_payment(uuid, bigint, text) TO anon;
