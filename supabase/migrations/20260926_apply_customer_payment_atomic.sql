-- Auditoría 2026: abonos de clientes atómicos.
-- Problema anterior: el frontend actualizaba orders.advance_payment y luego insertaba
-- la transaction en pasos separados. Un fallo entre ambos podía desincronizar deuda y caja.
-- Esta RPC hace toda la distribución + caja dentro de UNA transacción PostgreSQL.

CREATE OR REPLACE FUNCTION public.apply_customer_payment_atomic(
  p_customer_id uuid,
  p_amount bigint,
  p_cuenta text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining bigint;
  v_total_debt bigint;
  v_apply bigint;
  v_order record;
  v_customer_name text;
  v_orders_touched integer := 0;
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente requerido';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El abono debe ser mayor a 0';
  END IF;

  p_cuenta := UPPER(COALESCE(p_cuenta, ''));
  IF p_cuenta NOT IN ('EFECTIVO', 'VIRTUAL') THEN
    RAISE EXCEPTION 'La cuenta debe ser EFECTIVO o VIRTUAL';
  END IF;

  SELECT c.name
  INTO v_customer_name
  FROM public.customers c
  WHERE c.id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente inexistente';
  END IF;

  -- Bloqueamos todos los pedidos válidos con deuda para evitar dos abonos simultáneos
  -- sobre el mismo saldo.
  PERFORM 1
  FROM public.orders o
  WHERE o.customer_id = p_customer_id
    AND UPPER(COALESCE(o.status, '')) NOT IN ('CANCELADO', 'ANULADO')
    AND GREATEST(COALESCE(o.total_amount, 0) - COALESCE(o.advance_payment, 0), 0) > 0
  ORDER BY o.created_at, o.id
  FOR UPDATE;

  SELECT COALESCE(SUM(
    GREATEST(COALESCE(o.total_amount, 0) - COALESCE(o.advance_payment, 0), 0)
  ), 0)
  INTO v_total_debt
  FROM public.orders o
  WHERE o.customer_id = p_customer_id
    AND UPPER(COALESCE(o.status, '')) NOT IN ('CANCELADO', 'ANULADO');

  IF v_total_debt <= 0 THEN
    RAISE EXCEPTION 'El cliente no tiene saldo pendiente';
  END IF;

  IF p_amount > v_total_debt THEN
    RAISE EXCEPTION 'El abono supera la deuda total';
  END IF;

  v_remaining := p_amount;

  FOR v_order IN
    SELECT
      o.id,
      COALESCE(o.total_amount, 0) AS total_amount,
      COALESCE(o.advance_payment, 0) AS advance_payment
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
      AND UPPER(COALESCE(o.status, '')) NOT IN ('CANCELADO', 'ANULADO')
      AND GREATEST(COALESCE(o.total_amount, 0) - COALESCE(o.advance_payment, 0), 0) > 0
    ORDER BY o.created_at, o.id
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_apply := LEAST(
      GREATEST(v_order.total_amount - v_order.advance_payment, 0),
      v_remaining
    );

    IF v_apply <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.orders
    SET advance_payment = LEAST(total_amount, COALESCE(advance_payment, 0) + v_apply)
    WHERE id = v_order.id;

    INSERT INTO public.transactions (
      order_id,
      type,
      amount,
      description,
      cuenta
    ) VALUES (
      v_order.id,
      'INGRESO',
      v_apply,
      'Abono a cuenta de ' || COALESCE(NULLIF(BTRIM(v_customer_name), ''), 'Cliente') || ' (aplicado a encargo)',
      p_cuenta
    );

    v_remaining := v_remaining - v_apply;
    v_orders_touched := v_orders_touched + 1;
  END LOOP;

  IF v_remaining <> 0 THEN
    -- Si por cualquier inconsistencia no se pudo aplicar todo, abortamos TODO.
    RAISE EXCEPTION 'No se pudo distribuir el abono completo';
  END IF;

  RETURN jsonb_build_object(
    'applied_amount', p_amount,
    'orders_touched', v_orders_touched,
    'remaining_debt', v_total_debt - p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_customer_payment_atomic(uuid, bigint, text) TO anon;
