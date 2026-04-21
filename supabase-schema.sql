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
