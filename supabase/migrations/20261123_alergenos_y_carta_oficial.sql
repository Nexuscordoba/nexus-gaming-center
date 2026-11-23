-- ============================================================================
-- MIGRACIÓN SUPABASE: 14 ALÉRGENOS OBLIGATORIOS (REGLAMENTO UE 1169/2011)
-- ============================================================================

ALTER TABLE IF EXISTS public.productos_carta
  ADD COLUMN IF NOT EXISTS alergenos text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS trazas text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE IF EXISTS public.articulos_cafeteria
  ADD COLUMN IF NOT EXISTS alergenos text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS trazas text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE IF EXISTS public.guisos_programados
  ADD COLUMN IF NOT EXISTS alergenos text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS trazas text[] NOT NULL DEFAULT '{}'::text[];
