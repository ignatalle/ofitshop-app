-- Fase 4: registrar en caja los costos que Cami marca como YA PAGADOS al crear el pedido.
-- El pedido guarda por item:
--   needsPurchase=false  => la prenda ya fue comprada / el costo ya fue pagado
--   costAccount=EFECTIVO|VIRTUAL => cuenta desde donde salio la plata
-- Los items needsPurchase=true quedan para Compras Pendientes y NO generan egreso todavia.

CREATE OR REPLACE FUNCTION public.register_paid_item_costs_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_cost bigint;
  v_qty integer;
  v_total bigint;
  v_account text;
  v_supplier text;
  v_product text;
BEGIN
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb))
  LOOP
    -- Solo registrar caja cuando el costo ya fue pagado.
    IF COALESCE(v_item->>'needsPurchase', 'true') = 'true' THEN
      CONTINUE;
    END IF;

    BEGIN
      v_cost := COALESCE((v_item->>'wholesaleCost')::bigint, 0);
    EXCEPTION WHEN invalid_text_representation THEN
      v_cost := 0;
    END;

    IF v_cost <= 0 THEN
      RAISE EXCEPTION 'Un item marcado como costo pagado debe tener costo real mayor a 0';
    END IF;

    BEGIN
      v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::integer, 1));
    EXCEPTION WHEN invalid_text_representation THEN
      v_qty := 1;
    END;

    v_account := UPPER(COALESCE(v_item->>'costAccount', ''));
    IF v_account NOT IN ('EFECTIVO', 'VIRTUAL') THEN
      RAISE EXCEPTION 'Un item marcado como costo pagado debe indicar costAccount EFECTIVO o VIRTUAL';
    END IF;

    v_total := v_cost * v_qty;
    v_supplier := COALESCE(NULLIF(BTRIM(v_item->>'supplierName'), ''), 'Sin proveedor');
    v_product := COALESCE(NULLIF(BTRIM(v_item->>'productName'), ''), 'Producto');

    INSERT INTO public.transactions (
      order_id,
      type,
      amount,
      description,
      cuenta
    ) VALUES (
      NEW.id,
      'EGRESO',
      v_total,
      '[MERCADERIA] Compra a ' || v_supplier || ' - ' || v_product || ' (' || v_qty::text || 'x)',
      v_account
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_register_paid_item_costs_from_order
ON public.orders;

CREATE TRIGGER trg_register_paid_item_costs_from_order
AFTER INSERT
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.register_paid_item_costs_from_order();

GRANT EXECUTE ON FUNCTION public.register_paid_item_costs_from_order() TO anon;
