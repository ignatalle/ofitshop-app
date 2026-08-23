-- Fase 4: sincronización transaccional entre orders.items y pending_purchases.
-- Objetivos:
-- 1) Crear/actualizar automáticamente tareas PENDIENTE para items con needsPurchase=true.
-- 2) Eliminar solo tareas PENDIENTE cuando el item se elimina o needsPurchase pasa a false.
-- 3) Nunca reabrir ni borrar automáticamente tareas CONSEGUIDO / NO_DISPONIBLE.
--
-- Al ejecutarse como trigger dentro de la misma transacción que INSERT/UPDATE de orders,
-- evita que quede un pedido guardado sin su tarea operativa por un fallo posterior del frontend.

CREATE OR REPLACE FUNCTION public.sync_pending_purchases_from_order_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_item_id text;
  v_product_id uuid;
  v_supplier_id uuid;
  v_quantity integer;
  v_cost bigint;
BEGIN
  -- Primero limpiamos únicamente tareas todavía operativas que ya no corresponden
  -- al snapshot actual del pedido. Las tareas resueltas se preservan como historia.
  DELETE FROM public.pending_purchases pp
  WHERE pp.order_id = NEW.id
    AND pp.status = 'PENDIENTE'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) AS elem
      WHERE elem->>'id' = pp.item_id
        AND COALESCE(elem->>'needsPurchase', 'false') = 'true'
    );

  -- Luego aseguramos una tarea por cada item que requiere compra.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb))
  LOOP
    IF COALESCE(v_item->>'needsPurchase', 'false') <> 'true' THEN
      CONTINUE;
    END IF;

    v_item_id := NULLIF(v_item->>'id', '');
    IF v_item_id IS NULL THEN
      -- Los items nuevos de la app siempre tienen id estable. Si apareciera un
      -- histórico sin id, no inventamos uno porque rompería la correlación.
      CONTINUE;
    END IF;

    BEGIN
      v_product_id := NULLIF(v_item->>'productId', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_product_id := NULL;
    END;

    BEGIN
      v_supplier_id := NULLIF(v_item->>'supplierId', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_supplier_id := NULL;
    END;

    BEGIN
      v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::integer, 1));
    EXCEPTION WHEN invalid_text_representation THEN
      v_quantity := 1;
    END;

    BEGIN
      v_cost := NULLIF(COALESCE((v_item->>'wholesaleCost')::bigint, 0), 0);
    EXCEPTION WHEN invalid_text_representation THEN
      v_cost := NULL;
    END;

    INSERT INTO public.pending_purchases (
      order_id,
      item_id,
      product_id,
      supplier_id,
      customer_id,
      product_name,
      supplier_name,
      quantity,
      color,
      size,
      cost_price,
      status,
      updated_at
    ) VALUES (
      NEW.id,
      v_item_id,
      v_product_id,
      v_supplier_id,
      NEW.customer_id,
      COALESCE(NULLIF(v_item->>'productName', ''), 'Producto'),
      NULLIF(v_item->>'supplierName', ''),
      v_quantity,
      NULLIF(v_item->>'color', ''),
      NULLIF(v_item->>'size', ''),
      v_cost,
      'PENDIENTE',
      NOW()
    )
    ON CONFLICT (order_id, item_id)
    DO UPDATE SET
      product_id = EXCLUDED.product_id,
      supplier_id = EXCLUDED.supplier_id,
      customer_id = EXCLUDED.customer_id,
      product_name = EXCLUDED.product_name,
      supplier_name = EXCLUDED.supplier_name,
      quantity = EXCLUDED.quantity,
      color = EXCLUDED.color,
      size = EXCLUDED.size,
      cost_price = EXCLUDED.cost_price,
      updated_at = NOW()
    WHERE public.pending_purchases.status = 'PENDIENTE';
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pending_purchases_from_order_items
ON public.orders;

CREATE TRIGGER trg_sync_pending_purchases_from_order_items
AFTER INSERT OR UPDATE OF items
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_pending_purchases_from_order_items();
