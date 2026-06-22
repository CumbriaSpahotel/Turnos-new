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
    v_adjustments_total NUMERIC;
    v_calculated_closing NUMERIC;
    
    v_snap_year INTEGER;
    v_snap_open NUMERIC;
    v_snap_annual NUMERIC;
    v_snap_adj NUMERIC;
    v_snap_enjoyed NUMERIC;
    v_snap_planned NUMERIC;
    v_snap_close NUMERIC;
    v_snap_ref_date DATE;
    v_snap_calc_version TEXT;
BEGIN
    -- 1. Validar inputs básicos numéricos y bounds
    IF p_enjoyed_days IS NULL OR p_enjoyed_days < 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_ENJOYED_DAYS');
    END IF;
    IF p_planned_days IS NULL OR p_planned_days < 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_PLANNED_DAYS');
    END IF;
    IF p_closing_balance IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_CLOSING_BALANCE');
    END IF;
    IF p_calc_version IS NULL OR btrim(p_calc_version) = '' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_CALC_VERSION');
    END IF;
    IF p_year < 2000 OR p_year > 2100 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_YEAR');
    END IF;

    -- 2. Extraer y validar el Snapshot de forma segura (previniendo excepciones no controladas)
    IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_SNAPSHOT');
    END IF;

    BEGIN
        v_snap_year := (p_snapshot->>'year')::INTEGER;
        v_snap_open := (p_snapshot->>'openingBalance')::NUMERIC;
        v_snap_annual := (p_snapshot->>'annualEntitlement')::NUMERIC;
        v_snap_adj := (p_snapshot->>'adjustmentsTotal')::NUMERIC;
        v_snap_enjoyed := (p_snapshot->>'enjoyedDays')::NUMERIC;
        v_snap_planned := (p_snapshot->>'plannedFutureDays')::NUMERIC;
        v_snap_close := (p_snapshot->>'closingBalance')::NUMERIC;
        v_snap_ref_date := (p_snapshot->>'referenceDate')::DATE;
        v_snap_calc_version := p_snapshot->>'calculationVersion';
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_SNAPSHOT');
    END;

    IF v_snap_year IS NULL OR v_snap_open IS NULL OR v_snap_annual IS NULL OR v_snap_adj IS NULL OR 
       v_snap_enjoyed IS NULL OR v_snap_planned IS NULL OR v_snap_close IS NULL OR v_snap_ref_date IS NULL OR 
       v_snap_calc_version IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_SNAPSHOT');
    END IF;

    -- 3. Validar consistencia de parámetros enviados vs snapshot
    IF v_snap_calc_version <> p_calc_version OR
       round(v_snap_enjoyed, 2) <> round(p_enjoyed_days, 2) OR
       round(v_snap_planned, 2) <> round(p_planned_days, 2) OR
       round(v_snap_close, 2) <> round(p_closing_balance, 2) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'SNAPSHOT_MISMATCH');
    END IF;

    -- Validar fecha de referencia: Debe ser exactamente el 31 de diciembre del año en curso
    IF v_snap_ref_date <> make_date(p_year, 12, 31) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_REFERENCE_DATE');
    END IF;

    -- 4. Validar Autenticación. (Aún sin RLS, SECURITY DEFINER obliga a chequear al llamante)
    v_actor_id := auth.uid()::TEXT;
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    -- 5. Bloquear registro anual
    SELECT 
        id,
        opening_balance_days,
        annual_entitlement_days,
        version,
        is_closed,
        calculation_version,
        enjoyed_days_at_close,
        closing_balance_days,
        calculation_snapshot
    INTO v_year_row
    FROM employee_vacation_years
    WHERE employee_id = p_employee_id AND year = p_year
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'VACATION_YEAR_NOT_FOUND');
    END IF;

    -- Idempotencia real
    IF v_year_row.is_closed THEN
        IF v_year_row.calculation_version = p_calc_version AND
           round(v_year_row.enjoyed_days_at_close, 2) = round(p_enjoyed_days, 2) AND
           round(v_year_row.closing_balance_days, 2) = round(p_closing_balance, 2) AND
           v_year_row.calculation_snapshot::TEXT = p_snapshot::TEXT THEN
            RETURN jsonb_build_object('ok', true, 'alreadyClosed', true, 'vacationYearId', v_year_row.id, 'closingBalance', v_year_row.closing_balance_days, 'nextYearCreated', false);
        ELSE
            RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_CLOSED_CONFLICT');
        END IF;
    END IF;

    IF p_expected_version IS NULL OR v_year_row.version <> p_expected_version THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'VERSION_CONFLICT');
    END IF;

    -- 6. Obtener suma de ajustes vigentes en el servidor
    SELECT COALESCE(SUM(days), 0)
    INTO v_adjustments_total
    FROM employee_vacation_adjustments
    WHERE employee_vacation_year_id = v_year_row.id
      AND reversed_at IS NULL;

    -- 7. Validar ecuación matemáticamente en el servidor
    v_calculated_closing := v_year_row.opening_balance_days + v_year_row.annual_entitlement_days + v_adjustments_total - p_enjoyed_days;
    
    IF round(v_calculated_closing, 2) <> round(p_closing_balance, 2) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'CALCULATION_MISMATCH', 'expected', round(v_calculated_closing, 2), 'received', round(p_closing_balance, 2));
    END IF;
    
    -- Contrastar exhaustivamente el snapshot contra el motor relacional
    IF v_snap_year <> p_year OR
       round(v_snap_open, 2) <> round(v_year_row.opening_balance_days, 2) OR
       round(v_snap_annual, 2) <> round(v_year_row.annual_entitlement_days, 2) OR
       round(v_snap_adj, 2) <> round(v_adjustments_total, 2) OR
       round(v_snap_close, 2) <> round(v_calculated_closing, 2)
    THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'SNAPSHOT_MISMATCH');
    END IF;

    -- 8. Actualizar cierre
    UPDATE employee_vacation_years
    SET is_closed = true,
        closing_balance_days = round(v_calculated_closing, 2),
        closed_at = now(),
        closed_by = v_actor_id,
        enjoyed_days_at_close = round(p_enjoyed_days, 2),
        planned_days_at_close = round(p_planned_days, 2),
        calculation_version = p_calc_version,
        calculation_snapshot = p_snapshot,
        version = version + 1
    WHERE id = v_year_row.id;

    -- 9. Registrar acción de auditoría
    INSERT INTO employee_vacation_year_actions (
        employee_vacation_year_id, action_type, actor_id, previous_version, new_version, snapshot
    ) VALUES (
        v_year_row.id, 'CLOSE', v_actor_id, v_year_row.version, v_year_row.version + 1, p_snapshot
    );

    -- 10. Apertura/Upsert año siguiente
    SELECT * INTO v_next_year_row
    FROM employee_vacation_years
    WHERE employee_id = p_employee_id AND year = p_year + 1
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO employee_vacation_years (
            employee_id, year, opening_balance_days, opening_balance_source, source_vacation_year_id
        ) VALUES (
            p_employee_id, p_year + 1, round(v_calculated_closing, 2), 'PREVIOUS_YEAR_CLOSE', v_year_row.id
        );
        RETURN jsonb_build_object('ok', true, 'vacationYearId', v_year_row.id, 'closingBalance', round(v_calculated_closing, 2), 'nextYearCreated', true);
    ELSE
        -- Ya existe el año siguiente, validar compatibilidad estricta
        IF v_next_year_row.is_closed OR 
           v_next_year_row.opening_balance_source <> 'PREVIOUS_YEAR_CLOSE' OR 
           v_next_year_row.source_vacation_year_id <> v_year_row.id OR
           v_next_year_row.version > 1 THEN
            RETURN jsonb_build_object('ok', false, 'reason', 'NEXT_YEAR_CONFLICT');
        END IF;

        UPDATE employee_vacation_years
        SET opening_balance_days = round(v_calculated_closing, 2),
            version = version + 1
        WHERE id = v_next_year_row.id;
        
        RETURN jsonb_build_object('ok', true, 'vacationYearId', v_year_row.id, 'closingBalance', round(v_calculated_closing, 2), 'nextYearCreated', false, 'nextYearUpdated', true);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.close_employee_vacation_year(TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_employee_vacation_year(TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.close_employee_vacation_year(TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) FROM authenticated;

-- 7. TRIGGERS PROTECCIÓN DE AJUSTES
CREATE OR REPLACE FUNCTION protect_adjustments()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los ajustes no pueden ser eliminados físicamente.';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF OLD.days <> NEW.days OR OLD.reason <> NEW.reason THEN
            RAISE EXCEPTION 'El importe o motivo original de un ajuste no puede ser modificado una vez creado.';
        END IF;
        IF OLD.reversed_at IS NOT NULL AND (NEW.reversed_at IS DISTINCT FROM OLD.reversed_at OR NEW.reversed_by IS DISTINCT FROM OLD.reversed_by) THEN
            RAISE EXCEPTION 'Un ajuste ya revertido no puede volver a ser revertido o alterado.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_employee_vacation_adjustments ON public.employee_vacation_adjustments;
CREATE TRIGGER trg_protect_employee_vacation_adjustments
BEFORE UPDATE OR DELETE ON public.employee_vacation_adjustments
FOR EACH ROW EXECUTE FUNCTION protect_adjustments();

-- 8. RLS POLICIES
ALTER TABLE public.employee_vacation_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacation_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacation_year_actions ENABLE ROW LEVEL SECURITY;

-- Por defecto cerramos todo. La apertura deberá hacerse cuando se implementen los roles reales.
-- No existe tabla admins aún. Bloqueo total `FOR ALL USING (false) WITH CHECK (false)`.

DROP POLICY IF EXISTS employee_vacation_years_deny_all ON public.employee_vacation_years;
CREATE POLICY employee_vacation_years_deny_all
ON public.employee_vacation_years
FOR ALL
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS employee_vacation_adjustments_deny_all ON public.employee_vacation_adjustments;
CREATE POLICY employee_vacation_adjustments_deny_all
ON public.employee_vacation_adjustments
FOR ALL
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS employee_vacation_year_actions_deny_all ON public.employee_vacation_year_actions;
CREATE POLICY employee_vacation_year_actions_deny_all
ON public.employee_vacation_year_actions
FOR ALL
USING (false)
WITH CHECK (false);
