-- Auditoría 2026: clasificación estructurada de movimientos financieros.
-- Reduce la dependencia de textos/descripciones para calcular rentabilidad y cobros.
-- Es compatible con el historial existente y con el backoffice actual.

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS category text;

CREATE OR REPLACE FUNCTION public.classify_transaction_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_desc text := lower(COALESCE(NEW.description, ''));
BEGIN
  -- Si una llamada futura envía una categoría explícita válida, se conserva.
  IF NEW.category IN (
    'CUSTOMER_PAYMENT',
    'COMMISSION',
    'MERCHANDISE',
    'INTERNAL_TRANSFER',
    'OPERATING_EXPENSE',
    'PERSONAL_WITHDRAWAL',
    'RECONCILIATION',
    'OPENING_BALANCE',
    'OTHER_INCOME'
  ) THEN
    RETURN NEW;
  END IF;

  IF v_desc LIKE '%transferencia hacia%' OR v_desc LIKE '%transferencia desde%' THEN
    NEW.category := 'INTERNAL_TRANSFER';

  ELSIF v_desc LIKE '%[ajuste]%'
     OR v_desc LIKE '%ajuste de balance%'
     OR v_desc LIKE '%conciliacion de caja%'
     OR v_desc LIKE '%conciliación de caja%' THEN
    NEW.category := 'RECONCILIATION';

  ELSIF v_desc LIKE '%saldo inicial%'
     OR v_desc LIKE '%ingreso inicial%'
     OR v_desc LIKE '%balance inicial%'
     OR v_desc LIKE '%caja inicial%' THEN
    NEW.category := 'OPENING_BALANCE';

  ELSIF NEW.type = 'INGRESO' AND NEW.order_id IS NOT NULL THEN
    NEW.category := 'CUSTOMER_PAYMENT';

  ELSIF NEW.type = 'INGRESO' AND (
       v_desc LIKE '%pago inicial pedido%'
    OR v_desc LIKE '%abono a cuenta%'
    OR v_desc LIKE '%seña%'
    OR v_desc LIKE '%sena%'
    OR v_desc LIKE '%pago final%'
    OR v_desc LIKE '%cobro cliente%'
  ) THEN
    NEW.category := 'CUSTOMER_PAYMENT';

  ELSIF NEW.type = 'EGRESO' AND (
       v_desc LIKE '%comisión%'
    OR v_desc LIKE '%comision%'
  ) THEN
    NEW.category := 'COMMISSION';

  ELSIF NEW.type = 'EGRESO' AND (
       v_desc LIKE '%[mercaderia]%'
    OR v_desc LIKE '%[mercadería]%'
    OR v_desc LIKE '%compra de ropa%'
  ) THEN
    NEW.category := 'MERCHANDISE';

  ELSIF NEW.type = 'EGRESO' AND (
       v_desc LIKE '%[uso_personal]%'
    OR v_desc LIKE '%retiro%'
    OR v_desc LIKE '%socio%'
    OR v_desc LIKE '%gastos personales%'
    OR v_desc LIKE '%uso personal%'
  ) THEN
    NEW.category := 'PERSONAL_WITHDRAWAL';

  ELSIF NEW.type = 'EGRESO' THEN
    NEW.category := 'OPERATING_EXPENSE';

  ELSIF NEW.type = 'INGRESO' THEN
    NEW.category := 'OTHER_INCOME';

  ELSE
    NEW.category := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classify_transaction_category
ON public.transactions;

CREATE TRIGGER trg_classify_transaction_category
BEFORE INSERT OR UPDATE OF type, description, order_id, category
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.classify_transaction_category();

-- Backfill: hacemos pasar el historial por la misma función mediante un UPDATE.
UPDATE public.transactions
SET category = NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_category
ON public.transactions(category);

COMMENT ON COLUMN public.transactions.category IS
'Clasificación estructurada: CUSTOMER_PAYMENT, COMMISSION, MERCHANDISE, INTERNAL_TRANSFER, OPERATING_EXPENSE, PERSONAL_WITHDRAWAL, RECONCILIATION, OPENING_BALANCE, OTHER_INCOME';
