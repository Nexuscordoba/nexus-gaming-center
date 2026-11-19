-- ============================================================================
-- MIGRACIÓN SUPABASE: INGRESOS Y GASTOS GENERALES, EMPLEADOS, FICHAJES Y FACTURAS
-- Proyecto: Nexus Gaming Center & Cafetería (nexusgamingcenter.es)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLA: movimientos_generales (Módulo de Ingresos y Gastos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.movimientos_generales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),
  categoria text NOT NULL,
  tercero text NOT NULL,
  concepto text NOT NULL,
  numero_factura text,
  base_imponible numeric(10, 2) NOT NULL DEFAULT 0.00,
  tipo_iva numeric(5, 2) NOT NULL DEFAULT 21.00 CHECK (tipo_iva IN (0, 4, 10, 21)),
  cuota_iva numeric(10, 2) NOT NULL DEFAULT 0.00,
  total numeric(10, 2) NOT NULL DEFAULT 0.00,
  metodo_pago text DEFAULT 'transferencia',
  pagado boolean NOT NULL DEFAULT true,
  adjunto_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_generales_fecha ON public.movimientos_generales (fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_generales_tipo ON public.movimientos_generales (tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_generales_categoria ON public.movimientos_generales (categoria);
CREATE INDEX IF NOT EXISTS idx_movimientos_generales_pagado ON public.movimientos_generales (pagado);

-- RLS para movimientos_generales
ALTER TABLE public.movimientos_generales ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'movimientos_generales' AND policyname = 'Permitir todo en movimientos_generales'
  ) THEN
    CREATE POLICY "Permitir todo en movimientos_generales" ON public.movimientos_generales
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Realtime para movimientos_generales
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_generales;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END
$$;

-- ============================================================================
-- 2. BUCKET DE SUPABASE STORAGE: facturas_gastos
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('facturas_gastos', 'facturas_gastos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas para facturas_gastos en storage.objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Permitir lectura en facturas_gastos'
  ) THEN
    CREATE POLICY "Permitir lectura en facturas_gastos" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'facturas_gastos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Permitir subida en facturas_gastos'
  ) THEN
    CREATE POLICY "Permitir subida en facturas_gastos" ON storage.objects
      FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id = 'facturas_gastos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Permitir borrado en facturas_gastos'
  ) THEN
    CREATE POLICY "Permitir borrado en facturas_gastos" ON storage.objects
      FOR DELETE TO anon, authenticated
      USING (bucket_id = 'facturas_gastos');
  END IF;
END
$$;

-- ============================================================================
-- 3. ACTUALIZACIÓN Y POLÍTICAS DE TABLA: empleados
-- ============================================================================
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS fecha_alta date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS horario_asignado text,
  ADD COLUMN IF NOT EXISTS dias_trabajo text,
  ADD COLUMN IF NOT EXISTS horas_semanales numeric(5,2) DEFAULT 40.00;

-- Asegurar RLS permisivo para empleados (soluciona bloqueo en alternar estado activo/inactivo)
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo en empleados" ON public.empleados;
CREATE POLICY "Permitir todo en empleados" ON public.empleados
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. ACTUALIZACIÓN Y AUDITORÍA DE TABLA: fichajes
-- ============================================================================
ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS modificado_por text,
  ADD COLUMN IF NOT EXISTS modificado_el timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_modificacion text,
  ADD COLUMN IF NOT EXISTS eliminado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fichajes_empleado_fecha ON public.fichajes (empleado_id, timestamp_fichaje DESC);

ALTER TABLE public.fichajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo en fichajes" ON public.fichajes;
CREATE POLICY "Permitir todo en fichajes" ON public.fichajes
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. RELACIÓN BIDIRECCIONAL EN: facturas_tickets
-- ============================================================================
ALTER TABLE public.facturas_tickets
  ADD COLUMN IF NOT EXISTS factura_asociada_id uuid REFERENCES public.facturas_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS factura_asociada_numero text,
  ADD COLUMN IF NOT EXISTS cliente_email text,
  ADD COLUMN IF NOT EXISTS token_recibo text;

CREATE INDEX IF NOT EXISTS idx_facturas_tickets_origen ON public.facturas_tickets (ticket_origen_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tickets_asociada ON public.facturas_tickets (factura_asociada_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tickets_token ON public.facturas_tickets (token_recibo);

-- Asegurar RLS en facturas_tickets
ALTER TABLE public.facturas_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'facturas_tickets' AND policyname = 'Permitir todo en facturas_tickets'
  ) THEN
    CREATE POLICY "Permitir todo en facturas_tickets" ON public.facturas_tickets
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
