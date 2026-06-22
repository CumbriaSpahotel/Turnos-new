-- database/migrations/01_phase2_vacation_balances.sql

-- 1. EXTENSIÓN EMPLEADOS
ALTER TABLE public.empleados ADD COLUMN IF NOT EXISTS vacation_accrual_start_date DATE;

-- 2. TABLA: AÑOS VACACIONALES
CREATE TABLE IF NOT EXISTS public.employee_vacation_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
    year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    
    version INTEGER NOT NULL DEFAULT 1,
    annual_entitlement_days NUMERIC(7,2) NOT NULL DEFAULT 44,
    opening_balance_days NUMERIC(7,2) NOT NULL DEFAULT 0,
    opening_balance_source TEXT NOT NULL CHECK (opening_balance_source IN ('MIGRATION', 'PREVIOUS_YEAR_CLOSE', 'MANUAL')),
    source_vacation_year_id UUID REFERENCES public.employee_vacation_years(id),
    
    closing_balance_days NUMERIC(7,2),
    is_closed BOOLEAN NOT NULL DEFAULT false,
    
    -- Snapshots and Audit
    closed_at TIMESTAMPTZ,
    closed_by TEXT,
    reopened_at TIMESTAMPTZ,
    reopened_by TEXT,
    enjoyed_days_at_close NUMERIC(7,2),
    planned_days_at_close NUMERIC(7,2),
    calculation_version TEXT,
    calculation_snapshot JSONB,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT unique_employee_year UNIQUE (employee_id, year),
    -- Reglas de validación relacionales
    CONSTRAINT check_previous_close_source CHECK (
        (opening_balance_source = 'PREVIOUS_YEAR_CLOSE' AND source_vacation_year_id IS NOT NULL) OR
        (opening_balance_source IN ('MIGRATION', 'MANUAL'))
    )
);

CREATE INDEX IF NOT EXISTS idx_vacation_years_employee ON public.employee_vacation_years(employee_id);

-- 3. TABLA: AJUSTES (Auditoría Histórica)
CREATE TABLE IF NOT EXISTS public.employee_vacation_adjustments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_vacation_year_id UUID NOT NULL REFERENCES public.employee_vacation_years(id) ON DELETE RESTRICT,
    days NUMERIC(7,2) NOT NULL CHECK (days <> 0),
    reason TEXT NOT NULL CHECK (trim(reason) <> ''),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT,
    
    reversed_at TIMESTAMPTZ,
    reversed_by TEXT,
    reversal_reason TEXT
);

-- 4. TABLA: AUDITORÍA DE CIERRES/ACCIONES
CREATE TABLE IF NOT EXISTS public.employee_vacation_year_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_vacation_year_id UUID NOT NULL REFERENCES public.employee_vacation_years(id) ON DELETE RESTRICT,
    action_type TEXT NOT NULL CHECK (action_type IN ('CLOSE', 'REOPEN', 'OPENING_BALANCE_CHANGE')),
    actor_id TEXT,
    reason TEXT,
    previous_version INTEGER,
    new_version INTEGER,
    snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TRIGGER UPDATED_AT
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_employee_vacation_years_updated ON public.employee_vacation_years;
CREATE TRIGGER trg_employee_vacation_years_updated
BEFORE UPDATE ON public.employee_vacation_years
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 6. RPC: CIERRE TRANSACCIONAL
CREATE OR REPLACE FUNCTION close_employee_vacation_year(
    p_employee_id TEXT,
    p_year INTEGER,
    p_expected_version INTEGER,
    p_opening_balance NUMERIC,
    p_annual_entitlement NUMERIC,
    p_adjustments_total NUMERIC,
    p_closing_balance NUMERIC,
    p_enjoyed_days NUMERIC,
    p_planned_days NUMERIC,
    p_calc_version TEXT,
    p_snapshot JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_year_row RECORD;
    v_actor_id TEXT;
    v_next_year_row RECORD;
    v_calculated_closing NUMERIC;
BEGIN
    -- Validar autenticación
    v_actor_id := auth.uid()::TEXT;
    IF v_actor_id IS NULL THEN
        v_actor_id := 'SYSTEM'; -- En producción, requerir auth explícita
    END IF;

    -- Validar ecuación matemáticamente
    v_calculated_closing := p_opening_balance + p_annual_entitlement + p_adjustments_total - p_enjoyed_days;
    IF v_calculated_closing <> p_closing_balance THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'CALCULATION_MISMATCH', 'expected', v_calculated_closing, 'received', p_closing_balance);
    END IF;

    -- Bloquear registro
    SELECT * INTO v_year_row
    FROM employee_vacation_years
    WHERE employee_id = p_employee_id AND year = p_year
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'YEAR_NOT_FOUND');
    END IF;

    IF v_year_row.is_closed THEN
        RETURN jsonb_build_object('ok', true, 'alreadyClosed', true, 'vacationYearId', v_year_row.id, 'closingBalance', v_year_row.closing_balance_days, 'nextYearCreated', false);
    END IF;

    IF v_year_row.version <> p_expected_version THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'VERSION_CONFLICT');
    END IF;

    -- Actualizar cierre
    UPDATE employee_vacation_years
    SET is_closed = true,
        closing_balance_days = p_closing_balance,
        closed_at = now(),
        closed_by = v_actor_id,
        enjoyed_days_at_close = p_enjoyed_days,
        planned_days_at_close = p_planned_days,
        calculation_version = p_calc_version,
        calculation_snapshot = p_snapshot,
        version = version + 1
    WHERE id = v_year_row.id;

    -- Registrar acción
    INSERT INTO employee_vacation_year_actions (
        employee_vacation_year_id, action_type, actor_id, previous_version, new_version, snapshot
    ) VALUES (
        v_year_row.id, 'CLOSE', v_actor_id, v_year_row.version, v_year_row.version + 1, p_snapshot
    );

    -- Apertura/Upsert año siguiente
    SELECT * INTO v_next_year_row
    FROM employee_vacation_years
    WHERE employee_id = p_employee_id AND year = p_year + 1
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO employee_vacation_years (
            employee_id, year, opening_balance_days, opening_balance_source, source_vacation_year_id
        ) VALUES (
            p_employee_id, p_year + 1, p_closing_balance, 'PREVIOUS_YEAR_CLOSE', v_year_row.id
        );
        RETURN jsonb_build_object('ok', true, 'vacationYearId', v_year_row.id, 'closingBalance', p_closing_balance, 'nextYearCreated', true);
    ELSE
        -- Ya existe el año siguiente, validar compatibilidad
        IF v_next_year_row.is_closed OR 
           v_next_year_row.opening_balance_source <> 'PREVIOUS_YEAR_CLOSE' OR 
           v_next_year_row.source_vacation_year_id <> v_year_row.id OR
           v_next_year_row.version > 1 THEN
            RETURN jsonb_build_object('ok', false, 'reason', 'NEXT_YEAR_CONFLICT');
        END IF;

        UPDATE employee_vacation_years
        SET opening_balance_days = p_closing_balance,
            version = version + 1
        WHERE id = v_next_year_row.id;
        
        RETURN jsonb_build_object('ok', true, 'vacationYearId', v_year_row.id, 'closingBalance', p_closing_balance, 'nextYearCreated', false, 'nextYearUpdated', true);
    END IF;
END;
$$;

-- 7. RLS POLICIES
ALTER TABLE public.employee_vacation_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacation_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacation_year_actions ENABLE ROW LEVEL SECURITY;

-- Select: Todos los usuarios internos autenticados
CREATE POLICY "allow read for authenticated" ON public.employee_vacation_years FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "allow read for authenticated" ON public.employee_vacation_adjustments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "allow read for authenticated" ON public.employee_vacation_year_actions FOR SELECT USING (auth.role() = 'authenticated');

-- Insert/Update: Exclusivo de administrador o RPC interna
CREATE POLICY "allow write for admins" ON public.employee_vacation_years FOR ALL USING (
  false -- Ajustar a rol de administrador real según autenticación
);
CREATE POLICY "allow write for admins" ON public.employee_vacation_adjustments FOR ALL USING (false);
CREATE POLICY "allow write for admins" ON public.employee_vacation_year_actions FOR ALL USING (false);
