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
AS $$
DECLARE
  v_purchase public.pending_purchases%ROWTYPE;
  v_items jsonb;
  v_new_items jsonb;
  v_match_count integer;
  v_quantity integer;
  v_total_cost bigint;
  v_supplier text;
  v_description text;
BEGIN
  IF p_cost_price IS NULL OR p_cost_price <= 0 THEN
    RAISE EXCEPTION 'El costo real por unidad debe ser mayor a 0';
  END IF;

  IF p_cuenta IS NULL OR p_cuenta NOT IN ('EFECTIVO', 'VIRTUAL') THEN
    RAISE EXCEPTION 'La cuenta debe ser EFECTIVO o VIRTUAL';
  END IF;

  SELECT *
    INTO v_purchase
    FROM public.pending_purchases
   WHERE id = p_purchase_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra pendiente inexistente';
  END IF;

  IF v_purchase.status <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'La compra ya fue resuelta con estado %', v_purchase.status;
  END IF;

  SELECT items
    INTO v_items
    FROM public.orders
   WHERE id = v_purchase.order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el pedido original';
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'El pedido original no contiene una lista de items valida';
  END IF;

  SELECT count(*)
    INTO v_match_count
    FROM jsonb_array_elements(v_items) AS elem
   WHERE elem->>'id' = v_purchase.item_id;

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 item historico y se encontraron %', v_match_count;
  END IF;

  SELECT jsonb_agg(
           CASE
             WHEN elem->>'id' = v_purchase.item_id
               THEN jsonb_set(elem, '{wholesaleCost}', to_jsonb(p_cost_price), true)
             ELSE elem
           END
           ORDER BY ord
         )
    INTO v_new_items
    FROM jsonb_array_elements(v_items) WITH ORDINALITY AS x(elem, ord);

  UPDATE public.orders
     SET items = v_new_items
   WHERE id = v_purchase.order_id;

  v_quantity := GREATEST(1, COALESCE(v_purchase.quantity, 1));
  v_total_cost := p_cost_price * v_quantity;
  v_supplier := COALESCE(NULLIF(btrim(v_purchase.supplier_name), ''), 'Sin proveedor');
  v_description := '[MERCADERIA] Compra a ' || v_supplier || ' - ' ||
                   COALESCE(v_purchase.product_name, 'Producto') || ' (' ||
                   v_quantity::text || 'x)';

  INSERT INTO public.transactions (
    order_id,
    type,
    amount,
    description,
    cuenta
  )
  VALUES (
    v_purchase.order_id,
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
$$;

GRANT EXECUTE ON FUNCTION public.resolve_pending_purchase_with_payment(uuid, bigint, text) TO anon;
