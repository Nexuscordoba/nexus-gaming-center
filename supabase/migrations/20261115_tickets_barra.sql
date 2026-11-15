-- ============================================================================
-- MIGRACIÓN SUPABASE: MÓDULO TICKETS DE BARRA / CUENTAS RÁPIDAS
-- Separación completa de la gestión de barra respecto al plano de mesas
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: tickets_barra
CREATE TABLE IF NOT EXISTS public.tickets_barra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ticket text NOT NULL,
  cliente_alias text DEFAULT 'Barra',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(10,2) NOT NULL DEFAULT 0.00,
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cobrado', 'cancelado')),
  metodo_pago text CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'bizum', 'pendiente', null)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Índices de optimización para tiempo real
CREATE INDEX IF NOT EXISTS idx_tickets_barra_estado ON public.tickets_barra (estado);
CREATE INDEX IF NOT EXISTS idx_tickets_barra_created_at ON public.tickets_barra (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_barra_numero ON public.tickets_barra (numero_ticket);

-- 3. Habilitar RLS con política permisiva para el TPV
ALTER TABLE public.tickets_barra ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tickets_barra' AND policyname = 'Permitir todo en tickets_barra'
  ) THEN
    CREATE POLICY "Permitir todo en tickets_barra" ON public.tickets_barra
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- 4. Añadir a realtime para sincronizar cuentas de barra abiertas entre dispositivos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_barra;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END
$$;
