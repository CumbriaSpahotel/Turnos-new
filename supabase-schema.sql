-- ══════════════════════════════════════════════
-- TURNOSWEB — COMPREHENSIVE SUPABASE SCHEMA
-- ══════════════════════════════════════════════

-- 1. TABLA TURNOS
CREATE TABLE IF NOT EXISTS turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id text,
  fecha date,
  hotel_id text,
  tipo text,
  turno text,
  sustituto text,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);

-- INDICE ÚNICO PARA PREVENIR DUPLICADOS (OBLIGATORIO)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_turno ON turnos (empleado_id, fecha);

-- 2. TABLA EMPLEADOS
CREATE TABLE IF NOT EXISTS empleados (
  id text PRIMARY KEY,
  nombre text,
  hotel_id text,
  orden integer DEFAULT 999,
  activo boolean DEFAULT true,
  id_interno text, -- ID persistente visual/administrativo
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tipo_personal text DEFAULT 'fijo';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS estado_empresa text DEFAULT 'activo';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_baja date;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS motivo_baja text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS observaciones text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS hoteles_asignados text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS ajuste_vacaciones_dias numeric DEFAULT 0;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS vacaciones_regularizadas_pagadas boolean DEFAULT false;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS antiguedad text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS puesto text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS contrato text;

-- 3. TABLA VACACIONES
CREATE TABLE IF NOT EXISTS vacaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id text,
  fecha_inicio date,
  fecha_fin date
);

-- 4. TABLA BAJAS
CREATE TABLE IF NOT EXISTS bajas_permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id text,
  tipo text,
  fecha_inicio date,
  fecha_fin date
);

-- 5. TABLA PETICIONES DE CAMBIO
CREATE TABLE IF NOT EXISTS peticiones_cambio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel text,
  solicitante text,
  companero text,
  fechas jsonb,
  observaciones text,
  estado text DEFAULT 'pendiente',
  created_at timestamptz DEFAULT now()
);

-- 6. EVENTOS DE CUADRANTE
-- Fuente de verdad para cambios gestionados desde la app.
-- El Excel solo aporta turnos base; esta tabla aplica vacaciones, bajas,
-- permisos, sustituciones, cambios de hotel/posicion y cambios de turno.
CREATE TABLE IF NOT EXISTS eventos_cuadrante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  estado text DEFAULT 'activo',
  empleado_id text,
  empleado_destino_id text,
  hotel_origen text,
  hotel_destino text,
  puesto_origen text,
  puesto_destino text,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  turno_original text,
  turno_nuevo text,
  observaciones text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by text
);

CREATE INDEX IF NOT EXISTS idx_eventos_cuadrante_fechas
ON eventos_cuadrante (fecha_inicio, fecha_fin);

CREATE INDEX IF NOT EXISTS idx_eventos_cuadrante_estado
ON eventos_cuadrante (estado);

-- ══════════════════════════════════════════════
-- RLS (ROW LEVEL SECURITY) — CONFIGURACIÓN DE PRUEBAS
-- ══════════════════════════════════════════════

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajas_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_cuadrante ENABLE ROW LEVEL SECURITY;

-- POLÍTICA DE SEGURIDAD (OBLIGATORIO V8.2)
DROP POLICY IF EXISTS "allow all" ON turnos;
DROP POLICY IF EXISTS "solo autenticados" ON turnos;
CREATE POLICY "solo autenticados" ON turnos FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "allow all" ON empleados;
CREATE POLICY "allow all" ON empleados FOR ALL USING (true);

DROP POLICY IF EXISTS "allow all" ON vacaciones;
CREATE POLICY "allow all" ON vacaciones FOR ALL USING (true);

DROP POLICY IF EXISTS "allow all" ON bajas_permisos;
CREATE POLICY "allow all" ON bajas_permisos FOR ALL USING (true);

DROP POLICY IF EXISTS "allow all" ON eventos_cuadrante;
CREATE POLICY "allow all" ON eventos_cuadrante FOR ALL USING (true);

-- EJEMPLOS DE EVENTOS
-- Cambio de hotel/posicion entre Diana y Cristina:
-- INSERT INTO eventos_cuadrante
-- (tipo, empleado_id, empleado_destino_id, hotel_origen, hotel_destino, fecha_inicio, fecha_fin, observaciones)
-- VALUES
-- ('INTERCAMBIO_HOTEL', 'Diana', 'Cristina', 'Sercotel Guadiana', 'Cumbria Spa&Hotel', '2026-05-01', '2026-05-31', 'Intercambio temporal de posicion');
--
-- Baja con sustituto:
-- INSERT INTO eventos_cuadrante
-- (tipo, empleado_id, empleado_destino_id, hotel_origen, fecha_inicio, fecha_fin, observaciones)
-- VALUES
-- ('BAJA', 'Cristina', 'Miriam', 'Cumbria Spa&Hotel', '2026-05-10', null, 'Baja abierta con cobertura');
--
-- Cambio de turno puntual:
-- INSERT INTO eventos_cuadrante
-- (tipo, empleado_id, fecha_inicio, turno_nuevo, observaciones)
-- VALUES
-- ('CAMBIO_TURNO', 'Sergio', '2026-05-15', 'N', 'Cambio indicado por direccion');

-- 7. TABLA MENSAJES / NOTIFICACIONES
CREATE TABLE IF NOT EXISTS mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emisor text,
  receptor text DEFAULT 'ADMIN',
  asunto text,
  cuerpo text,
  tipo text DEFAULT 'info', -- info, aviso, urgente
  leido boolean DEFAULT false,
  hotel_id text,
  created_at timestamptz DEFAULT now()
);

-- RLS PARA MENSAJES
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON mensajes;
CREATE POLICY "allow all" ON mensajes FOR ALL USING (true);

-- ══════════════════════════════════════════════
-- MIGRACIÓN / POBLADO INICIAL DE EMPLEADOS
-- ══════════════════════════════════════════════

INSERT INTO empleados (id, nombre, hotel_id)
SELECT DISTINCT empleado_id, empleado_id, hotel_id
FROM turnos
ON CONFLICT (id) DO NOTHING;

-- 8. TABLA TURNOS BASE
CREATE TABLE IF NOT EXISTS turnos_base (
  empleado_id text,
  fecha date,
  turno text,
  hotel_id text,
  PRIMARY KEY (empleado_id, fecha)
);

ALTER TABLE turnos_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON turnos_base FOR ALL USING (true);

-- ══════════════════════════════════════════════
-- 9. COLUMNA solicitud_id EN EVENTOS_CUADRANTE
-- Vincula eventos creados automáticamente por triggers
-- ══════════════════════════════════════════════

ALTER TABLE eventos_cuadrante ADD COLUMN IF NOT EXISTS solicitud_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_evento_solicitud_fecha
ON eventos_cuadrante (solicitud_id, fecha_inicio)
WHERE solicitud_id IS NOT NULL;

-- ══════════════════════════════════════════════
-- 10. TRIGGER: SYNC PETICIONES → EVENTOS_CUADRANTE
-- Cuando una petición se aprueba/rechaza/anula,
-- el trigger crea/desactiva eventos automáticamente.
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_evento_desde_peticion()
RETURNS trigger AS $$
DECLARE
  fecha_item jsonb;
  fecha_val  date;
BEGIN

  -- CASO 1: APROBADA → crear evento(s) activo(s)
  IF NEW.estado = 'aprobada' AND (OLD.estado IS NULL OR OLD.estado IS DISTINCT FROM 'aprobada') THEN

    -- Las peticiones almacenan fechas como JSON array: [{fecha, origen, destino, nota}]
    IF NEW.fechas IS NOT NULL AND jsonb_array_length(NEW.fechas) > 0 THEN
      FOR fecha_item IN SELECT * FROM jsonb_array_elements(NEW.fechas)
      LOOP
        fecha_val := (fecha_item->>'fecha')::date;

        -- Evitar duplicados por solicitud_id + fecha
        IF NOT EXISTS (
          SELECT 1 FROM eventos_cuadrante
          WHERE solicitud_id = NEW.id
            AND fecha_inicio = fecha_val
        ) THEN
          INSERT INTO eventos_cuadrante (
            tipo,
            empleado_id,
            empleado_destino_id,
            fecha_inicio,
            fecha_fin,
            turno_nuevo,
            estado,
            solicitud_id,
            observaciones,
            payload,
            created_at,
            updated_at,
            updated_by
          ) VALUES (
            CASE WHEN NEW.companero IS NOT NULL AND NEW.companero <> ''
              THEN 'INTERCAMBIO_TURNO'
              ELSE 'CAMBIO_TURNO'
            END,
            NEW.solicitante,
            NULLIF(NEW.companero, ''),
            fecha_val,
            fecha_val,
            fecha_item->>'destino',
            'activo',
            NEW.id,
            COALESCE(NEW.observaciones, 'Aprobado automáticamente'),
            jsonb_build_object('peticion_id', NEW.id, 'original_data', fecha_item),
            now(),
            now(),
            'TRIGGER_SYNC'
          );
        ELSE
          -- Si ya existe, reactivar
          UPDATE eventos_cuadrante
          SET estado = 'activo', updated_at = now(), updated_by = 'TRIGGER_SYNC'
          WHERE solicitud_id = NEW.id AND fecha_inicio = fecha_val;
        END IF;
      END LOOP;
    END IF;

  END IF;

  -- CASO 2: RECHAZADA / ANULADA → desactivar eventos
  IF NEW.estado IN ('rechazada', 'anulada')
    AND (OLD.estado IS NULL OR OLD.estado IS DISTINCT FROM NEW.estado) THEN

    UPDATE eventos_cuadrante
    SET estado = 'anulado', updated_at = now(), updated_by = 'TRIGGER_SYNC'
    WHERE solicitud_id = NEW.id;

  END IF;

  -- CASO 3: Volver a PENDIENTE desde aprobada → desactivar también
  IF NEW.estado = 'pendiente' AND OLD.estado = 'aprobada' THEN

    UPDATE eventos_cuadrante
    SET estado = 'anulado', updated_at = now(), updated_by = 'TRIGGER_SYNC'
    WHERE solicitud_id = NEW.id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger (idempotente)
DROP TRIGGER IF EXISTS trigger_sync_evento_desde_peticion ON peticiones_cambio;

CREATE TRIGGER trigger_sync_evento_desde_peticion
AFTER UPDATE ON peticiones_cambio
FOR EACH ROW
EXECUTE FUNCTION sync_evento_desde_peticion();

-- 11. SISTEMA DE AUDITORÍA Y PUBLICACIONES
CREATE TABLE IF NOT EXISTS publicaciones_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamptz DEFAULT now(),
  usuario text,
  cambios_totales integer DEFAULT 0,
  empleados_afectados integer DEFAULT 0,
  resumen_json jsonb DEFAULT '{}'::jsonb,
  cambios_detalle_json jsonb DEFAULT '[]'::jsonb, -- Trazabilidad: [{empleado_id, fecha, anterior, nuevo}]
  estado text DEFAULT 'ok',
  revertida boolean DEFAULT false
);

ALTER TABLE publicaciones_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON publicaciones_log;
CREATE POLICY "allow all" ON publicaciones_log FOR ALL USING (true);

-- 12. TABLA SNAPSHOTS DE CUADRANTE (ARQUITECTURA FIJA)
-- Almacena el resultado final horneado por Admin para consumo de Index y App Móvil.
CREATE TABLE IF NOT EXISTS public.publicaciones_cuadrante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_publicacion timestamptz DEFAULT now(),
  semana_inicio date NOT NULL,
  semana_fin date NOT NULL,
  hotel text NOT NULL,
  estado text DEFAULT 'activo', -- 'activo' o 'reemplazado'
  version integer DEFAULT 1,
  publicado_por text,
  resumen jsonb,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publicaciones_cuadrante_semana
ON public.publicaciones_cuadrante (semana_inicio, semana_fin);

CREATE INDEX IF NOT EXISTS idx_publicaciones_cuadrante_hotel
ON public.publicaciones_cuadrante (hotel);

CREATE INDEX IF NOT EXISTS idx_publicaciones_cuadrante_estado
ON public.publicaciones_cuadrante (estado);

ALTER TABLE public.publicaciones_cuadrante ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.publicaciones_cuadrante;
CREATE POLICY "allow all" ON public.publicaciones_cuadrante FOR ALL USING (true);
