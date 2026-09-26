-- Auditoría 2026: creación de pedido + cobro inicial + comisión en una sola transacción.
-- Los triggers existentes sobre orders siguen resolviendo de forma atómica:
--   1) costos ya pagados -> transactions [MERCADERIA]
--   2) items needsPurchase=true -> pending_purchases
-- Por eso esta RPC elimina la ventana de inconsistencia del frontend.

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_customer_id uuid,
  p_items jsonb,
  p_details text,
  p_advance_payment bigint,
  p_payment_method text,
  p_cuenta text,
  p_commission bigint DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total bigint := 0;
  v_item jsonb;
  v_qty integer;
  v_unit_price bigint;
  v_subtotal bigint;
  v_customer_name text;
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente requerido';
  END IF;

  SELECT c.name
  INTO v_customer_name
  FROM public.customers c
  WHERE c.id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente inexistente';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un item';
  END IF;

  -- El total se recalcula en servidor desde el snapshot histórico de items.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::integer, 1));
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Cantidad inválida en un item';
    END;

    BEGIN
      v_unit_price := COALESCE((v_item->>'unitPrice')::bigint, 0);
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Precio inválido en un item';
    END;

    IF v_unit_price <= 0 THEN
      RAISE EXCEPTION 'Todos los items deben tener precio de venta mayor a 0';
    END IF;

    v_subtotal := v_unit_price * v_qty;
    v_total := v_total + v_subtotal;
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'El total del pedido debe ser mayor a 0';
  END IF;

  p_advance_payment := COALESCE(p_advance_payment, 0);
  IF p_advance_payment < 0 OR p_advance_payment > v_total THEN
    RAISE EXCEPTION 'El pago inicial debe estar entre 0 y el total del pedido';
  END IF;

  p_commission := COALESCE(p_commission, 0);
  IF p_commission < 0 OR p_commission > p_advance_payment THEN
    RAISE EXCEPTION 'La comisión debe estar entre 0 y el pago inicial';
  END IF;

  p_cuenta := UPPER(COALESCE(p_cuenta, ''));
  IF p_advance_payment > 0 AND p_cuenta NOT IN ('EFECTIVO', 'VIRTUAL') THEN
    RAISE EXCEPTION 'La cuenta debe ser EFECTIVO o VIRTUAL';
  END IF;

  INSERT INTO public.orders (
    customer_id,
    details,
    items,
    total_amount,
    advance_payment,
    status
  ) VALUES (
    p_customer_id,
    COALESCE(NULLIF(BTRIM(p_details), ''), 'Pedido'),
    p_items,
    v_total,
    p_advance_payment,
    'PENDIENTE'
  )
  RETURNING id INTO v_order_id;

  -- Estos INSERT ocurren en la misma transacción que el pedido.
  IF p_advance_payment > 0 THEN
    INSERT INTO public.transactions (
      order_id,
      type,
      amount,
      description,
      cuenta
    ) VALUES (
      v_order_id,
      'INGRESO',
      p_advance_payment,
      'Pago inicial pedido (' || COALESCE(NULLIF(BTRIM(p_payment_method), ''), p_cuenta) || '): ' ||
        COALESCE(NULLIF(BTRIM(v_customer_name), ''), 'Cliente'),
      p_cuenta
    );

    IF p_commission > 0 THEN
      INSERT INTO public.transactions (
        order_id,
        type,
        amount,
        description,
        cuenta
      ) VALUES (
        v_order_id,
        'EGRESO',
        p_commission,
        '[COMISION] Comisión de tarjeta',
        p_cuenta
      );
    END IF;
  END IF;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(uuid, jsonb, text, bigint, text, text, bigint) TO anon;
