-- Schema para TurnosWeb en Supabase

CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id TEXT NOT NULL,
    fecha DATE NOT NULL,
    turno TEXT,
    hotel_id TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('VAC','BAJA','PERM','NORMAL','CT')),
    updated_at TIMESTAMP DEFAULT now(),
    updated_by TEXT
);

-- Indices
CREATE UNIQUE INDEX IF NOT EXISTS uniq_turno ON turnos (empleado_id, fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $body
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$body LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON turnos;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON turnos
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Reglas RLS
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ""lectura_global"" ON turnos;
CREATE POLICY ""lectura_global""
ON turnos FOR SELECT
USING (true);

DROP POLICY IF EXISTS ""solo_usuarios_autenticados_escribir"" ON turnos;
CREATE POLICY ""solo_usuarios_autenticados_escribir""
ON turnos FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
