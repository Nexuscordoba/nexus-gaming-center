-- ============================================================================
-- MIGRACIÓN: HARDENING DE GUISOS (CORTE HORARIO, CUPO Y AUTO-CONFIRMACIÓN)
--            E IDEMPOTENCIA EN MOVIMIENTOS_GENERALES (CIERRES Z)
-- ============================================================================

-- 1. Columna opcional de cupo máximo en guisos_programados
ALTER TABLE public.guisos_programados
  ADD COLUMN IF NOT EXISTS max_raciones integer CHECK (max_raciones IS NULL OR max_raciones > 0);

-- 2. Validación en BD de corte horario, estado y cupo máximo al reservar guisos
CREATE OR REPLACE FUNCTION public.fn_validar_corte_y_cupo_guiso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guiso record;
  v_fecha_corte date;
  v_hora_corte text;
  v_limite_ts timestamp;
  v_ahora_madrid timestamp;
  v_total_raciones integer;
BEGIN
  -- Bloquear la fila del guiso para evitar condiciones de carrera en cupo
  SELECT id, fecha, fecha_corte, hora_corte, estado, max_raciones
    INTO v_guiso
    FROM public.guisos_programados
   WHERE id = NEW.guiso_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El guiso seleccionado no existe.';
  END IF;

  IF v_guiso.estado = 'cancelado' THEN
    RAISE EXCEPTION 'Este guiso ha sido cancelado y no admite reservas.';
  END IF;

  -- Validar fecha y hora de corte en zona horaria Europe/Madrid
  v_fecha_corte := COALESCE(v_guiso.fecha_corte, (v_guiso.fecha - INTERVAL '1 day')::date);
  v_hora_corte := COALESCE(NULLIF(trim(v_guiso.hora_corte), ''), '21:00');
  IF v_hora_corte ~ '^\d{1,2}:\d{2}$' THEN
    v_limite_ts := (v_fecha_corte::text || ' ' || lpad(split_part(v_hora_corte, ':', 1), 2, '0') || ':' || split_part(v_hora_corte, ':', 2) || ':00')::timestamp;
    v_ahora_madrid := now() AT TIME ZONE 'Europe/Madrid';
    IF v_ahora_madrid > v_limite_ts THEN
      RAISE EXCEPTION 'El plazo de preventa para este guiso ha finalizado (% %).', v_fecha_corte, v_hora_corte;
    END IF;
  END IF;

  -- Validar cupo máximo si está configurado
  IF v_guiso.max_raciones IS NOT NULL THEN
    SELECT COALESCE(SUM(raciones), 0)
      INTO v_total_raciones
      FROM public.reservas_guisos
     WHERE guiso_id = NEW.guiso_id
       AND estado_pago NOT IN ('expirado', 'cancelado');

    IF (v_total_raciones + NEW.raciones) > v_guiso.max_raciones THEN
      RAISE EXCEPTION 'Cupo máximo de raciones alcanzado (%/% disponibles).', GREATEST(0, v_guiso.max_raciones - v_total_raciones), v_guiso.max_raciones;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_corte_y_cupo_guiso ON public.reservas_guisos;
CREATE TRIGGER trg_validar_corte_y_cupo_guiso
  BEFORE INSERT ON public.reservas_guisos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validar_corte_y_cupo_guiso();

-- 3. Asegurar trigger de auto-confirmación al alcanzar min_raciones
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
   WHERE guiso_id = NEW.guiso_id
     AND estado_pago NOT IN ('expirado', 'cancelado');

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

-- 4. Índice único en movimientos_generales para evitar duplicados al sincronizar Cierres Z
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_generales_ventas_tpv_factura
  ON public.movimientos_generales (numero_factura)
  WHERE tipo = 'INGRESO' AND categoria = 'VENTAS_TPV' AND numero_factura IS NOT NULL;
