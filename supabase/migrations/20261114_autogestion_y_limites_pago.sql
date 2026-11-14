-- ============================================================================
-- MIGRACIÓN: CONFIG_GUISOS, EXPIRACIÓN DE RESERVAS Y AUTOGESTIÓN DE CLIENTE
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: config_guisos (Configuración global del módulo de guisos)
CREATE TABLE IF NOT EXISTS public.config_guisos (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  horas_limite_preventa numeric NOT NULL DEFAULT 4,
  horas_limite_directo numeric NOT NULL DEFAULT 1,
  telefono_whatsapp text NOT NULL DEFAULT '34624454242',
  numero_bizum text NOT NULL DEFAULT '624 45 42 42',
  enlace_pago text NOT NULL DEFAULT 'https://www.nexusgamingcenter.es/#guisos',
  instrucciones_pago text NOT NULL DEFAULT 'Indica en el concepto de Bizum: GUISO y tu Nombre',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fila por defecto si no existe
INSERT INTO public.config_guisos (id, horas_limite_preventa, horas_limite_directo, telefono_whatsapp, numero_bizum, enlace_pago, instrucciones_pago)
VALUES (1, 4, 1, '34624454242', '624 45 42 42', 'https://www.nexusgamingcenter.es/#guisos', 'Indica en el concepto de Bizum: GUISO y tu Nombre')
ON CONFLICT (id) DO NOTHING;

-- RLS para config_guisos
ALTER TABLE public.config_guisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de config_guisos" ON public.config_guisos;
CREATE POLICY "Lectura publica de config_guisos"
  ON public.config_guisos FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Modificacion de config_guisos" ON public.config_guisos;
CREATE POLICY "Modificacion de config_guisos"
  ON public.config_guisos FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Añadir expira_pago_at y soportar estados expirado y cancelado en reservas_guisos
ALTER TABLE public.reservas_guisos
  ADD COLUMN IF NOT EXISTS expira_pago_at timestamptz;

-- Si existe una restricción CHECK en estado_pago, actualizarla para admitir 'expirado' y 'cancelado'
DO $$
BEGIN
  ALTER TABLE public.reservas_guisos DROP CONSTRAINT IF EXISTS reservas_guisos_estado_pago_check;
  ALTER TABLE public.reservas_guisos ADD CONSTRAINT reservas_guisos_estado_pago_check 
    CHECK (estado_pago IN ('pendiente', 'pagado', 'expirado', 'cancelado'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservas_guisos_expira_pago ON public.reservas_guisos (estado_pago, expira_pago_at);

-- 3. Función RPC para limpiar reservas expiradas y liberar mesas
CREATE OR REPLACE FUNCTION public.limpiar_reservas_guisos_expiradas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_modificadas integer := 0;
BEGIN
  -- 1. Actualizar reservas_guisos vencidas a 'expirado'
  WITH expiradas AS (
    UPDATE public.reservas_guisos
    SET estado_pago = 'expirado'
    WHERE estado_pago = 'pendiente'
      AND expira_pago_at IS NOT NULL
      AND expira_pago_at < now()
    RETURNING id
  )
  SELECT count(*) INTO v_modificadas FROM expiradas;

  -- 2. Liberar mesa asociada en reservas_mesas poniéndola en estado 'cancelada'
  UPDATE public.reservas_mesas
  SET estado = 'cancelada'
  WHERE estado = 'confirmada'
    AND reserva_guiso_id IN (
      SELECT id FROM public.reservas_guisos
      WHERE estado_pago IN ('expirado', 'cancelado')
    );

  -- 3. REGLA DE PERMANENCIA: Los guisos que hayan alcanzado 'confirmado' NUNCA
  -- retroceden a 'buscando_minimo' por expiración de reservas. El guiso se queda confirmado.

  RETURN v_modificadas;
END;
$$;

-- 4. REGLA DE INTEGRIDAD: Un guiso 'confirmado' NUNCA puede retroceder a 'buscando_minimo'
CREATE OR REPLACE FUNCTION public.fn_proteger_guiso_confirmado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si el guiso ya estaba en 'confirmado' y se intenta cambiar a 'buscando_minimo',
  -- se preserva obligatoriamente en 'confirmado'
  IF OLD.estado = 'confirmado' AND NEW.estado = 'buscando_minimo' THEN
    NEW.estado := 'confirmado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_guiso_confirmado ON public.guisos_programados;
CREATE TRIGGER trg_proteger_guiso_confirmado
  BEFORE UPDATE ON public.guisos_programados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_proteger_guiso_confirmado();

-- 5. Actualizar fn_verificar_minimo_guiso para excluir raciones expiradas o canceladas
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
  -- Sumar únicamente raciones válidas y activas
  SELECT COALESCE(SUM(raciones), 0)
    INTO v_total_raciones
    FROM public.reservas_guisos
   WHERE guiso_id = NEW.guiso_id
     AND estado_pago NOT IN ('expirado', 'cancelado');

  SELECT min_raciones, estado
    INTO v_min_raciones, v_estado_actual
    FROM public.guisos_programados
   WHERE id = NEW.guiso_id;

  -- Solo pasa a confirmado si estaba buscando mínimo y alcanza el objetivo
  IF v_estado_actual = 'buscando_minimo' AND v_total_raciones >= v_min_raciones THEN
    UPDATE public.guisos_programados
       SET estado = 'confirmado'
     WHERE id = NEW.guiso_id;
  END IF;

  RETURN NEW;
END;
$$;
