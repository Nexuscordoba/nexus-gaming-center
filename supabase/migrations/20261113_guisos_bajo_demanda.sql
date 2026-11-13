-- ============================================================================
-- MIGRACIÓN SUPABASE: MÓDULO "GUISOS BAJO DEMANDA" (PREVENTA GASTRONÓMICA)
-- Proyecto: Nexus Gaming Center & Café Bar (nexusgamingcenter.es)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: guisos_programados
CREATE TABLE IF NOT EXISTS public.guisos_programados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  fecha_corte date,
  hora_corte text NOT NULL DEFAULT '21:00',
  nombre_plato text NOT NULL,
  descripcion text DEFAULT '',
  min_raciones integer NOT NULL DEFAULT 8 CHECK (min_raciones > 0),
  precio_barra numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (precio_barra >= 0),
  precio_takeaway numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (precio_takeaway >= 0),
  imagen_url text DEFAULT '',
  estado text NOT NULL DEFAULT 'buscando_minimo' CHECK (estado IN ('buscando_minimo', 'confirmado', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Asegurar que la columna fecha_corte exista si la tabla fue creada previamente
ALTER TABLE public.guisos_programados
  ADD COLUMN IF NOT EXISTS fecha_corte date;

-- Rellenar fecha_corte por defecto (1 día antes de fecha) en registros previos que no la tengan
UPDATE public.guisos_programados
   SET fecha_corte = (fecha - INTERVAL '1 day')::date
 WHERE fecha_corte IS NULL;

-- Índices para optimizar consultas por calendario semanal y estado
CREATE INDEX IF NOT EXISTS idx_guisos_programados_fecha ON public.guisos_programados (fecha);
CREATE INDEX IF NOT EXISTS idx_guisos_programados_estado ON public.guisos_programados (estado);

-- 2. TABLA: reservas_guisos
CREATE TABLE IF NOT EXISTS public.reservas_guisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guiso_id uuid NOT NULL REFERENCES public.guisos_programados(id) ON DELETE CASCADE,
  nombre_cliente text NOT NULL,
  telefono text NOT NULL,
  email text,
  raciones integer NOT NULL DEFAULT 1 CHECK (raciones > 0),
  modalidad text NOT NULL DEFAULT 'barra' CHECK (modalidad IN ('barra', 'takeaway')),
  estado_pago text NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para cruce rápido de raciones por guiso y búsqueda de clientes
CREATE INDEX IF NOT EXISTS idx_reservas_guisos_guiso_id ON public.reservas_guisos (guiso_id);
CREATE INDEX IF NOT EXISTS idx_reservas_guisos_estado_pago ON public.reservas_guisos (estado_pago);

-- 3. TABLA OPCIONAL DE APOYO: newsletter_guisos (para captación de leads gastronómicos)
CREATE TABLE IF NOT EXISTS public.newsletter_guisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  nombre_cliente text,
  telefono text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.guisos_programados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_guisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_guisos ENABLE ROW LEVEL SECURITY;

-- Políticas para guisos_programados:
DROP POLICY IF EXISTS "Lectura publica de guisos_programados" ON public.guisos_programados;
CREATE POLICY "Lectura publica de guisos_programados"
  ON public.guisos_programados
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Insercion de guisos_programados" ON public.guisos_programados;
CREATE POLICY "Insercion de guisos_programados"
  ON public.guisos_programados
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizacion de guisos_programados" ON public.guisos_programados;
CREATE POLICY "Actualizacion de guisos_programados"
  ON public.guisos_programados
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Eliminacion de guisos_programados" ON public.guisos_programados;
CREATE POLICY "Eliminacion de guisos_programados"
  ON public.guisos_programados
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Políticas para reservas_guisos:
DROP POLICY IF EXISTS "Lectura publica de reservas_guisos" ON public.reservas_guisos;
CREATE POLICY "Lectura publica de reservas_guisos"
  ON public.reservas_guisos
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Insercion publica de reservas_guisos" ON public.reservas_guisos;
CREATE POLICY "Insercion publica de reservas_guisos"
  ON public.reservas_guisos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizacion de reservas_guisos" ON public.reservas_guisos;
CREATE POLICY "Actualizacion de reservas_guisos"
  ON public.reservas_guisos
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Eliminacion de reservas_guisos" ON public.reservas_guisos;
CREATE POLICY "Eliminacion de reservas_guisos"
  ON public.reservas_guisos
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Políticas para newsletter_guisos:
DROP POLICY IF EXISTS "Lectura newsletter_guisos" ON public.newsletter_guisos;
CREATE POLICY "Lectura newsletter_guisos"
  ON public.newsletter_guisos
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Insercion newsletter_guisos" ON public.newsletter_guisos;
CREATE POLICY "Insercion newsletter_guisos"
  ON public.newsletter_guisos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizacion newsletter_guisos" ON public.newsletter_guisos;
CREATE POLICY "Actualizacion newsletter_guisos"
  ON public.newsletter_guisos
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCIÓN Y TRIGGER AUTOMÁTICO DE CONFIRMACIÓN POR UMBRAL DE RACIONES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_verificar_minimo_guiso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_raciones integer;
  v_min_raciones integer;
  v_estado_actual text;
BEGIN
  SELECT COALESCE(SUM(raciones), 0)
    INTO v_total_raciones
    FROM public.reservas_guisos
   WHERE guiso_id = NEW.guiso_id;

  SELECT min_raciones, estado
    INTO v_min_raciones, v_estado_actual
    FROM public.guisos_programados
   WHERE id = NEW.guiso_id;

  IF v_estado_actual = 'buscando_minimo' AND v_total_raciones >= v_min_raciones THEN
    UPDATE public.guisos_programados
       SET estado = 'confirmado'
     WHERE id = NEW.guiso_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirmar_guiso ON public.reservas_guisos;
CREATE TRIGGER trg_auto_confirmar_guiso
  AFTER INSERT OR UPDATE OF raciones ON public.reservas_guisos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_verificar_minimo_guiso();

-- Habilitar Realtime para ambas tablas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.guisos_programados;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas_guisos;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
