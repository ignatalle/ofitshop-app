-- Fase 4: compras pendientes / encargos a conseguir.
-- Esta migración es idempotente para que pueda conservarse como respaldo del esquema
-- aunque la tabla haya sido creada previamente desde el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS public.pending_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    supplier_name TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    color TEXT,
    size TEXT,
    cost_price BIGINT CHECK (cost_price IS NULL OR cost_price >= 0),
    status TEXT NOT NULL DEFAULT 'PENDIENTE'
      CHECK (status IN ('PENDIENTE', 'CONSEGUIDO', 'NO_DISPONIBLE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (order_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_purchases_status
  ON public.pending_purchases(status);

CREATE INDEX IF NOT EXISTS idx_pending_purchases_supplier
  ON public.pending_purchases(supplier_id);

CREATE INDEX IF NOT EXISTS idx_pending_purchases_supplier_status
  ON public.pending_purchases(supplier_id, status);

ALTER TABLE public.pending_purchases ENABLE ROW LEVEL SECURITY;

-- Seguridad temporal mientras el backoffice todavía no usa Supabase Auth.
-- Antes de publicar la tienda al público esta policy debe reemplazarse por
-- políticas separadas: lectura pública limitada y escritura solo autenticada.
DROP POLICY IF EXISTS "Permitir acceso anónimo a pending_purchases"
  ON public.pending_purchases;

CREATE POLICY "Permitir acceso anónimo a pending_purchases"
ON public.pending_purchases FOR ALL
TO anon
USING (true)
WITH CHECK (true);
