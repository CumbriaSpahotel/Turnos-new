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
  solicitante text,
  companero text,
  fechas jsonb,
  observaciones text,
  estado text DEFAULT 'pendiente',
  created_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════
-- RLS (ROW LEVEL SECURITY) — CONFIGURACIÓN DE PRUEBAS
-- ══════════════════════════════════════════════

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajas_permisos ENABLE ROW LEVEL SECURITY;

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

-- ══════════════════════════════════════════════
-- MIGRACIÓN / POBLADO INICIAL DE EMPLEADOS
-- ══════════════════════════════════════════════

INSERT INTO empleados (id, nombre, hotel_id)
SELECT DISTINCT empleado_id, empleado_id, hotel_id
FROM turnos
ON CONFLICT (id) DO NOTHING;
