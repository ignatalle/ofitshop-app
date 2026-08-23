-- Fase 4: resolución atómica de una compra pendiente.
-- Congela el costo histórico dentro de orders.items y marca la tarea CONSEGUIDO
-- dentro de la MISMA transacción de PostgreSQL.

CREATE OR REPLACE FUNCTION public.resolve_pending_purchase(
  p_purchase_id uuid,
  p_cost_price bigint
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
BEGIN
  IF p_cost_price IS NULL OR p_cost_price <= 0 THEN
    RAISE EXCEPTION 'El costo real debe ser mayor a 0';
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
    RAISE EXCEPTION 'El pedido original no contiene una lista de items válida';
  END IF;

  SELECT COUNT(*)
  INTO v_match_count
  FROM jsonb_array_elements(v_items) AS elem
  WHERE elem->>'id' = v_purchase.item_id;

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 item histórico y se encontraron %', v_match_count;
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

  UPDATE public.pending_purchases
  SET
    status = 'CONSEGUIDO',
    cost_price = p_cost_price,
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_purchase_id;
END;
$$;

-- Temporal: el backoffice actual todavía usa la anon key.
-- Reemplazar por authenticated cuando se implemente Supabase Auth.
GRANT EXECUTE ON FUNCTION public.resolve_pending_purchase(uuid, bigint) TO anon;
