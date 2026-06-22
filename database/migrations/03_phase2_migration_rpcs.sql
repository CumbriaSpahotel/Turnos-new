-- MIGRACIÓN FASE 2B: FUNCIONES RPC ADMINISTRATIVAS DE LOTES

SET search_path = public, pg_temp;

-- 1. begin_apply_vacation_batch
CREATE OR REPLACE FUNCTION begin_apply_vacation_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_batch RECORD;
    v_attempt_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;
    
    IF NOT has_active_admin_role(v_actor_id, 'VACATION_IMPORTER') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS';
    END IF;

    SELECT * INTO v_batch FROM vacation_migration_batches WHERE batch_id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BATCH_NOT_FOUND';
    END IF;

    IF v_batch.status <> 'APPROVED' THEN
        RAISE EXCEPTION 'INVALID_BATCH_STATUS_FOR_APPLY';
    END IF;

    v_attempt_id := gen_random_uuid();

    UPDATE vacation_migration_batches
    SET status = 'APPLYING',
        applying_by = v_actor_id,
        applying_at = now(),
        apply_attempt_id = v_attempt_id,
        attempt_count = attempt_count + 1,
        last_attempt_at = now()
    WHERE batch_id = p_batch_id;

    INSERT INTO vacation_migration_batch_actions (
        batch_id, action_type, actor_id, previous_status, new_status, apply_attempt_id, batch_version
    ) VALUES (
        p_batch_id, 'BEGIN_APPLY', v_actor_id, v_batch.status, 'APPLYING', v_attempt_id, v_batch.approved_batch_version
    );

    RETURN jsonb_build_object('ok', true, 'apply_attempt_id', v_attempt_id);
END;
$$;

-- 2. import_vacation_batch
CREATE OR REPLACE FUNCTION import_vacation_batch(
    p_batch_id UUID,
    p_expected_batch_version INTEGER,
    p_expected_source_hash TEXT,
    p_expected_payload_hash TEXT,
    p_apply_attempt_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_batch RECORD;
    v_row RECORD;
    v_emp_count INTEGER := 0;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    IF NOT has_active_admin_role(v_actor_id, 'VACATION_IMPORTER') THEN RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS'; END IF;

    SELECT * INTO v_batch FROM vacation_migration_batches WHERE batch_id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_NOT_FOUND'; END IF;

    IF v_batch.status <> 'APPLYING' THEN RAISE EXCEPTION 'INVALID_STATUS_NOT_APPLYING'; END IF;
    IF v_batch.applying_by <> v_actor_id THEN RAISE EXCEPTION 'APPLY_ACTOR_MISMATCH'; END IF;
    IF v_batch.apply_attempt_id <> p_apply_attempt_id THEN RAISE EXCEPTION 'INVALID_ATTEMPT_ID'; END IF;
    IF v_batch.approved_batch_version <> p_expected_batch_version THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
    IF v_batch.source_file_hash <> p_expected_source_hash THEN RAISE EXCEPTION 'SOURCE_HASH_MISMATCH'; END IF;
    IF v_batch.normalized_payload_hash <> p_expected_payload_hash THEN RAISE EXCEPTION 'PAYLOAD_HASH_MISMATCH'; END IF;

    -- Comprobar si hay filas invalidas
    SELECT COUNT(*) INTO v_emp_count FROM vacation_migration_batch_rows 
    WHERE batch_id = p_batch_id AND validation_status <> 'VALID';
    IF v_emp_count > 0 THEN RAISE EXCEPTION 'BATCH_CONTAINS_INVALID_ROWS'; END IF;

    FOR v_row IN SELECT * FROM vacation_migration_batch_rows WHERE batch_id = p_batch_id
    LOOP
        -- Revalidar si ya existe
        IF EXISTS (SELECT 1 FROM employee_vacation_years WHERE employee_id = v_row.employee_id AND year = v_row.vacation_year) THEN
            RAISE EXCEPTION 'RECORD_ALREADY_EXISTS: %', v_row.employee_id;
        END IF;

        INSERT INTO employee_vacation_years (
            employee_id, year, opening_balance_days, annual_entitlement_days, opening_balance_source, 
            version, is_closed, record_origin, record_status, migration_batch_id
        ) VALUES (
            v_row.employee_id, v_row.vacation_year, v_row.opening_balance_days, v_row.annual_entitlement_days, 'MIGRATION', 
            1, false, 'MIGRATION', 'ACTIVE', p_batch_id
        );
        
        -- Obtener ID insertado
        DECLARE v_year_id UUID;
        BEGIN
            SELECT id INTO v_year_id FROM employee_vacation_years WHERE employee_id = v_row.employee_id AND year = v_row.vacation_year;
            INSERT INTO employee_vacation_year_actions (
                employee_vacation_year_id, action_type, actor_id, previous_version, new_version, snapshot
            ) VALUES (
                v_year_id, 'MIGRATION_CREATE', v_actor_id, 0, 1, jsonb_build_object('batch_id', p_batch_id)
            );
        END;
    END LOOP;

    UPDATE vacation_migration_batches
    SET status = 'APPLIED',
        applied_by = v_actor_id,
        applied_at = now()
    WHERE batch_id = p_batch_id;

    INSERT INTO vacation_migration_batch_actions (
        batch_id, action_type, actor_id, previous_status, new_status, apply_attempt_id, batch_version
    ) VALUES (
        p_batch_id, 'APPLY', v_actor_id, 'APPLYING', 'APPLIED', p_apply_attempt_id, v_batch.approved_batch_version
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. mark_batch_failed
CREATE OR REPLACE FUNCTION mark_batch_failed(
    p_batch_id UUID,
    p_apply_attempt_id UUID,
    p_failure_code TEXT,
    p_failure_detail TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_batch RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    IF NOT has_active_admin_role(v_actor_id, 'VACATION_IMPORTER') THEN RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS'; END IF;

    SELECT * INTO v_batch FROM vacation_migration_batches WHERE batch_id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_NOT_FOUND'; END IF;

    IF v_batch.status <> 'APPLYING' THEN RAISE EXCEPTION 'INVALID_STATUS_NOT_APPLYING'; END IF;
    IF v_batch.apply_attempt_id <> p_apply_attempt_id THEN RAISE EXCEPTION 'INVALID_ATTEMPT_ID'; END IF;

    UPDATE vacation_migration_batches
    SET status = 'FAILED',
        failure_code = p_failure_code,
        failure_detail = p_failure_detail
    WHERE batch_id = p_batch_id;

    INSERT INTO vacation_migration_batch_actions (
        batch_id, action_type, actor_id, previous_status, new_status, apply_attempt_id, reason, batch_version
    ) VALUES (
        p_batch_id, 'APPLY_FAILED', v_actor_id, 'APPLYING', 'FAILED', p_apply_attempt_id, p_failure_code, v_batch.approved_batch_version
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. rollback_vacation_migration_batch
CREATE OR REPLACE FUNCTION rollback_vacation_migration_batch(
    p_batch_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_batch RECORD;
    v_year_row RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    IF NOT has_active_admin_role(v_actor_id, 'SYSTEM_ADMIN') THEN RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS'; END IF;

    SELECT * INTO v_batch FROM vacation_migration_batches WHERE batch_id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_NOT_FOUND'; END IF;

    IF v_batch.status <> 'APPLIED' THEN RAISE EXCEPTION 'INVALID_BATCH_STATUS_FOR_ROLLBACK'; END IF;

    -- Validaciones de rollback_conflict
    FOR v_year_row IN SELECT * FROM employee_vacation_years WHERE migration_batch_id = p_batch_id FOR UPDATE
    LOOP
        IF v_year_row.is_closed THEN RAISE EXCEPTION 'ROLLBACK_CONFLICT_CLOSED: %', v_year_row.employee_id; END IF;
        IF EXISTS(SELECT 1 FROM employee_vacation_adjustments WHERE employee_vacation_year_id = v_year_row.id) THEN
            RAISE EXCEPTION 'ROLLBACK_CONFLICT_ADJUSTMENTS: %', v_year_row.employee_id;
        END IF;
        IF EXISTS(SELECT 1 FROM employee_vacation_years WHERE source_vacation_year_id = v_year_row.id) THEN
            RAISE EXCEPTION 'ROLLBACK_CONFLICT_FUTURE_LINKED: %', v_year_row.employee_id;
        END IF;
        IF EXISTS(SELECT 1 FROM employee_vacation_year_actions WHERE employee_vacation_year_id = v_year_row.id AND action_type <> 'MIGRATION_CREATE') THEN
            RAISE EXCEPTION 'ROLLBACK_CONFLICT_ACTIONS_PRESENT: %', v_year_row.employee_id;
        END IF;
    END LOOP;

    -- Proceder con rollback lógico atómico
    FOR v_year_row IN SELECT * FROM employee_vacation_years WHERE migration_batch_id = p_batch_id
    LOOP
        UPDATE employee_vacation_years
        SET record_status = 'ROLLED_BACK',
            rolled_back_at = now(),
            rolled_back_by = v_actor_id,
            rollback_reason = p_reason,
            version = version + 1
        WHERE id = v_year_row.id;

        INSERT INTO employee_vacation_year_actions (
            employee_vacation_year_id, action_type, actor_id, previous_version, new_version, snapshot
        ) VALUES (
            v_year_row.id, 'MIGRATION_ROLLBACK', v_actor_id, v_year_row.version, v_year_row.version + 1, jsonb_build_object('reason', p_reason)
        );
    END LOOP;

    UPDATE vacation_migration_batches
    SET status = 'ROLLED_BACK',
        rolled_back_at = now(),
        rolled_back_by = v_actor_id,
        rollback_reason = p_reason
    WHERE batch_id = p_batch_id;

    INSERT INTO vacation_migration_batch_actions (
        batch_id, action_type, actor_id, previous_status, new_status, reason, batch_version
    ) VALUES (
        p_batch_id, 'ROLLBACK', v_actor_id, 'APPLIED', 'ROLLED_BACK', p_reason, v_batch.approved_batch_version
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. replace_migration_record
CREATE OR REPLACE FUNCTION replace_migration_record(
    p_employee_id TEXT,
    p_year INTEGER,
    p_new_opening_balance NUMERIC,
    p_new_annual_entitlement NUMERIC,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_year_row RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
    IF NOT has_active_admin_role(v_actor_id, 'SYSTEM_ADMIN') THEN RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS'; END IF;

    SELECT * INTO v_year_row FROM employee_vacation_years WHERE employee_id = p_employee_id AND year = p_year FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;

    IF v_year_row.record_status <> 'ROLLED_BACK' THEN RAISE EXCEPTION 'NOT_ROLLED_BACK'; END IF;

    UPDATE employee_vacation_years
    SET opening_balance_days = p_new_opening_balance,
        annual_entitlement_days = p_new_annual_entitlement,
        record_status = 'ACTIVE',
        version = version + 1
    WHERE id = v_year_row.id;

    INSERT INTO employee_vacation_year_actions (
        employee_vacation_year_id, action_type, actor_id, previous_version, new_version, snapshot
    ) VALUES (
        v_year_row.id, 'MIGRATION_REPLACE', v_actor_id, v_year_row.version, v_year_row.version + 1, 
        jsonb_build_object(
            'reason', p_reason,
            'old_opening_balance', v_year_row.opening_balance_days,
            'new_opening_balance', p_new_opening_balance,
            'old_annual_entitlement', v_year_row.annual_entitlement_days,
            'new_annual_entitlement', p_new_annual_entitlement
        )
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Revocación general
REVOKE ALL ON FUNCTION begin_apply_vacation_batch FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION import_vacation_batch FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mark_batch_failed FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rollback_vacation_migration_batch FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION replace_migration_record FROM PUBLIC, anon, authenticated;
