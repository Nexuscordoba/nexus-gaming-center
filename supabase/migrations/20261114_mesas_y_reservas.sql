-- ============================================================================
-- MIGRACIÓN SUPABASE: MÓDULO MESAS LOCAL, RESERVAS DE SALA Y CONEXIÓN CON GUISOS
-- Tablas: mesas_local, reservas_mesas, columnas adicionales en reservas_guisos
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: mesas_local
CREATE TABLE IF NOT EXISTS public.mesas_local (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL,
  zona text NOT NULL DEFAULT 'interior' CHECK (zona IN ('interior', 'terraza')),
  capacidad integer NOT NULL DEFAULT 4 CHECK (capacidad > 0),
  activa boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_mesas_local_numero_zona UNIQUE (numero, zona)
);

CREATE INDEX IF NOT EXISTS idx_mesas_local_zona_activa ON public.mesas_local (zona, activa);

-- 2. TABLA: reservas_mesas
CREATE TABLE IF NOT EXISTS public.reservas_mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id uuid REFERENCES public.mesas_local(id) ON DELETE SET NULL,
  reserva_guiso_id uuid REFERENCES public.reservas_guisos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora_servicio text NOT NULL, -- ej. '14:00'
  zona_preferida text NOT NULL DEFAULT 'interior' CHECK (zona_preferida IN ('interior', 'terraza')),
  comensales integer NOT NULL DEFAULT 2 CHECK (comensales > 0),
  nombre_cliente text NOT NULL,
  telefono text NOT NULL,
  estado text NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'cancelada', 'finalizada')),
  observaciones text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservas_mesas_fecha_hora ON public.reservas_mesas (fecha, hora_servicio);
CREATE INDEX IF NOT EXISTS idx_reservas_mesas_mesa_id ON public.reservas_mesas (mesa_id);

-- 3. Actualizar reservas_guisos para soportar hora_servicio, zona_preferida, comensales y mesa_id
ALTER TABLE public.reservas_guisos
  ADD COLUMN IF NOT EXISTS hora_servicio text DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS zona_preferida text DEFAULT 'interior',
  ADD COLUMN IF NOT EXISTS comensales integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS mesa_id uuid REFERENCES public.mesas_local(id) ON DELETE SET NULL;

-- 4. Actualizar comandas_cocina si no tuviera columna reserva_guiso_id para vinculación
ALTER TABLE public.comandas_cocina
  ADD COLUMN IF NOT EXISTS reserva_guiso_id uuid REFERENCES public.reservas_guisos(id) ON DELETE SET NULL;

-- 5. Insertar mesas por defecto si la tabla está vacía (ej: 8 mesas Interior, 6 mesas Terraza)
INSERT INTO public.mesas_local (numero, zona, capacidad, activa, orden)
SELECT m.numero, m.zona, m.capacidad, true, m.numero
FROM (
  VALUES
    (1, 'interior', 4),
    (2, 'interior', 4),
    (3, 'interior', 4),
    (4, 'interior', 2),
    (5, 'interior', 2),
    (6, 'interior', 6),
    (7, 'interior', 6),
    (8, 'interior', 8),
    (1, 'terraza', 4),
    (2, 'terraza', 4),
    (3, 'terraza', 4),
    (4, 'terraza', 4),
    (5, 'terraza', 6),
    (6, 'terraza', 6)
) AS m(numero, zona, capacidad)
WHERE NOT EXISTS (SELECT 1 FROM public.mesas_local LIMIT 1);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE public.mesas_local ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_mesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de mesas_local" ON public.mesas_local;
CREATE POLICY "Lectura publica de mesas_local"
  ON public.mesas_local FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Gestion de mesas_local" ON public.mesas_local;
CREATE POLICY "Gestion de mesas_local"
  ON public.mesas_local FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica de reservas_mesas" ON public.reservas_mesas;
CREATE POLICY "Lectura publica de reservas_mesas"
  ON public.reservas_mesas FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Gestion de reservas_mesas" ON public.reservas_mesas;
CREATE POLICY "Gestion de reservas_mesas"
  ON public.reservas_mesas FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas_local;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas_mesas;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
