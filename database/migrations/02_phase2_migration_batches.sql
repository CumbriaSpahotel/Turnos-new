-- MIGRACIÓN FASE 2B: ESTRUCTURA ADMINISTRATIVA DE LOTES Y ROLES

SET search_path = public, pg_temp;

-- 1. TABLAS DE AUTORIZACIÓN ADMINISTRATIVA
CREATE TABLE IF NOT EXISTS public.system_admin_users (
    user_id UUID PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID
);

CREATE TABLE IF NOT EXISTS public.system_admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.system_admin_users(user_id) ON DELETE RESTRICT,
    role_name TEXT NOT NULL CHECK (role_name IN (
        'VACATION_VIEWER', 
        'VACATION_PREPARER', 
        'VACATION_REVIEWER', 
        'VACATION_APPROVER', 
        'VACATION_IMPORTER', 
        'VACATION_CLOSER', 
        'SYSTEM_ADMIN'
    )),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    UNIQUE(user_id, role_name)
);

-- RLS para Auth Administrativo
ALTER TABLE public.system_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_admin_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "denegar_select_users" ON public.system_admin_users FOR SELECT USING (false);
CREATE POLICY "denegar_select_roles" ON public.system_admin_roles FOR SELECT USING (false);
CREATE POLICY "denegar_write_users" ON public.system_admin_users FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "denegar_write_roles" ON public.system_admin_roles FOR ALL USING (false) WITH CHECK (false);

-- Función auxiliar para verificar roles activos
CREATE OR REPLACE FUNCTION has_active_admin_role(p_user_id UUID, p_role_name TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_has_role BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM system_admin_roles r
        JOIN system_admin_users u ON r.user_id = u.user_id
        WHERE u.user_id = p_user_id
          AND u.is_active = true
          AND u.revoked_at IS NULL
          AND r.role_name = p_role_name
          AND r.revoked_at IS NULL
    ) INTO v_has_role;
    RETURN v_has_role;
END;
$$;
REVOKE ALL ON FUNCTION has_active_admin_role FROM PUBLIC, anon, authenticated;


-- 2. ALTERACIÓN DE LA TABLA employee_vacation_years
DO $$
BEGIN
    -- Añadir columnas para gestionar origen y rollback lógico si no existen
    ALTER TABLE public.employee_vacation_years ADD COLUMN record_origin TEXT DEFAULT 'MANUAL' CHECK (record_origin IN ('MIGRATION', 'PREVIOUS_YEAR_CLOSE', 'MANUAL'));
    ALTER TABLE public.employee_vacation_years ADD COLUMN record_status TEXT DEFAULT 'ACTIVE' CHECK (record_status IN ('ACTIVE', 'ROLLED_BACK'));
    ALTER TABLE public.employee_vacation_years ADD COLUMN migration_batch_id UUID;
    ALTER TABLE public.employee_vacation_years ADD COLUMN rolled_back_at TIMESTAMPTZ;
    ALTER TABLE public.employee_vacation_years ADD COLUMN rolled_back_by UUID;
    ALTER TABLE public.employee_vacation_years ADD COLUMN rollback_reason TEXT;
EXCEPTION WHEN duplicate_column THEN
    NULL;
END $$;


-- 3. TABLAS DE LOTES DE MIGRACIÓN
CREATE TABLE IF NOT EXISTS public.vacation_migration_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cutoff_date DATE NOT NULL,
    vacation_year INTEGER NOT NULL,
    source_file_name TEXT,
    source_file_hash TEXT NOT NULL,
    normalized_payload_hash TEXT NOT NULL,
    importer_version TEXT NOT NULL,
    validation_schema_version TEXT,
    calculation_version TEXT,
    
    rows_received INTEGER,
    rows_valid INTEGER,
    rows_rejected INTEGER,
    
    status TEXT NOT NULL CHECK (status IN (
        'DRAFT', 'VALIDATED', 'PENDING_APPROVAL', 'APPROVED', 
        'APPLYING', 'APPLIED', 'FAILED', 'ROLLED_BACK', 'CANCELLED'
    )),
    
    prepared_by UUID,
    prepared_at TIMESTAMPTZ,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    approved_batch_version INTEGER DEFAULT 1,
    self_approval BOOLEAN DEFAULT false,
    self_approval_reason TEXT,
    approval_notes TEXT,
    rejected_reason TEXT,
    
    applying_by UUID,
    applying_at TIMESTAMPTZ,
    apply_attempt_id UUID,
    applied_by UUID,
    applied_at TIMESTAMPTZ,
    
    failure_code TEXT,
    failure_detail TEXT,
    last_attempt_at TIMESTAMPTZ,
    attempt_count INTEGER DEFAULT 0,
    
    rolled_back_at TIMESTAMPTZ,
    rolled_back_by UUID,
    rollback_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vacation_migration_batch_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.vacation_migration_batches(batch_id) ON DELETE RESTRICT,
    row_number INTEGER NOT NULL,
    employee_id TEXT NOT NULL,
    cutoff_date DATE NOT NULL,
    vacation_year INTEGER NOT NULL,
    opening_balance_days NUMERIC(7,2),
    annual_entitlement_days NUMERIC(7,2),
    legacy_adjustment_reviewed TEXT,
    legacy_adjustment_included TEXT,
    justification TEXT,
    
    legacy_annual_entitlement_snapshot TEXT,
    legacy_adjustment_snapshot TEXT,
    employee_active_snapshot TEXT,
    
    validation_status TEXT,
    validation_codes JSONB,
    normalized_row_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(batch_id, employee_id),
    UNIQUE(batch_id, row_number)
);

CREATE TABLE IF NOT EXISTS public.vacation_migration_batch_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.vacation_migration_batches(batch_id) ON DELETE RESTRICT,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'CREATE', 'VALIDATE', 'SUBMIT_FOR_APPROVAL', 'APPROVE', 'SELF_APPROVE', 
        'REJECT', 'BEGIN_APPLY', 'APPLY', 'APPLY_FAILED', 'ROLLBACK', 'REPLACE_RECORD', 'CANCEL'
    )),
    actor_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    previous_status TEXT,
    new_status TEXT,
    reason TEXT,
    batch_version INTEGER,
    apply_attempt_id UUID,
    snapshot JSONB
);

-- RLS
ALTER TABLE public.vacation_migration_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_migration_batch_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_migration_batch_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "denegar_select_mb" ON public.vacation_migration_batches FOR SELECT USING (false);
CREATE POLICY "denegar_write_mb" ON public.vacation_migration_batches FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "denegar_select_mbr" ON public.vacation_migration_batch_rows FOR SELECT USING (false);
CREATE POLICY "denegar_write_mbr" ON public.vacation_migration_batch_rows FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "denegar_select_mba" ON public.vacation_migration_batch_actions FOR SELECT USING (false);
CREATE POLICY "denegar_write_mba" ON public.vacation_migration_batch_actions FOR ALL USING (false) WITH CHECK (false);

-- FK a employee_vacation_years
DO $$
BEGIN
    ALTER TABLE public.employee_vacation_years
        ADD CONSTRAINT fk_migration_batch 
        FOREIGN KEY (migration_batch_id) 
        REFERENCES public.vacation_migration_batches(batch_id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
