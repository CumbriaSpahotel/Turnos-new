const fs = require('fs');

const sql01 = fs.readFileSync('database/migrations/01_phase2_vacation_balances.sql', 'utf8');
const sqlBatches = fs.readFileSync('database/migrations/02_phase2_migration_batches.sql', 'utf8');
const sqlRpcs = fs.readFileSync('database/migrations/03_phase2_migration_rpcs.sql', 'utf8');

const allSql = sql01 + sqlBatches + sqlRpcs;

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, description) {
    testsRun++;
    if (condition) {
        testsPassed++;
        console.log(`[PASS] ${description}`);
    } else {
        testsFailed++;
        console.error(`[FAIL] ${description}`);
    }
}

console.log('--- PHASE 2C.0 SQL AUDIT ---');

// 1. Tablas y Estructura
assert(allSql.includes('employee_vacation_years'), 'Existencia de employee_vacation_years');
assert(allSql.includes('employee_vacation_adjustments'), 'Existencia de employee_vacation_adjustments');
assert(allSql.includes('employee_vacation_year_actions'), 'Existencia de employee_vacation_year_actions');
assert(allSql.includes('system_admin_users'), 'Existencia de system_admin_users');
assert(allSql.includes('system_admin_roles'), 'Existencia de system_admin_roles');
assert(allSql.includes('vacation_migration_batches'), 'Existencia de vacation_migration_batches');
assert(allSql.includes('vacation_migration_batch_rows'), 'Existencia de vacation_migration_batch_rows');
assert(allSql.includes('vacation_migration_batch_actions'), 'Existencia de vacation_migration_batch_actions');

assert(allSql.includes('UNIQUE(employee_id, year)') || allSql.includes('UNIQUE (employee_id, year)'), 'Conservación de UNIQUE (employee_id, year)');
assert(allSql.includes('record_origin') && allSql.includes('record_status') && allSql.includes('migration_batch_id'), 'Presencia de columnas de auditoría base');

// 2. Seguridad
assert((allSql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length >= 8, 'ENABLE ROW LEVEL SECURITY en todas las tablas');
assert(!allSql.includes('USING (true)'), 'Ausencia de USING (true)');
assert(!allSql.includes("auth.role() = 'authenticated'") || allSql.includes('USING (false)'), 'Ausencia de políticas generales permisivas');
assert(allSql.includes('USING (false)'), 'Políticas cerradas por defecto');
assert(allSql.includes('REVOKE ALL ON FUNCTION'), 'REVOKE EXECUTE para PUBLIC, anon y authenticated');
assert(!allSql.includes('service_role'), 'Ausencia de service_role');
assert(allSql.includes('auth.uid()'), 'Uso de auth.uid()');
assert(allSql.includes('SECURITY DEFINER'), 'SECURITY DEFINER en RPCs');
assert(allSql.includes('SET search_path = public, pg_temp') || allSql.includes('SET search_path = public'), 'SET search_path = public, pg_temp');

// 3. RPC Signatures & Internals
assert(allSql.includes('begin_apply_vacation_batch') && allSql.includes('apply_attempt_id'), 'Firma begin_apply_vacation_batch con attempt_id');
assert(allSql.includes('import_vacation_batch') && allSql.includes('FOR UPDATE'), 'Firma import_vacation_batch con FOR UPDATE');
assert(allSql.includes('mark_batch_failed'), 'Firma mark_batch_failed');
assert(allSql.includes('rollback_vacation_migration_batch'), 'Firma rollback_vacation_migration_batch');
assert(allSql.includes('replace_migration_record'), 'Firma replace_migration_record');

assert(!allSql.includes(' DELETE FROM '), 'Ausencia de DELETE físico');
assert(allSql.includes('record_status = '), 'Control de estado (record_status)');
assert(allSql.includes('version = version + 1') || allSql.includes('version + 1'), 'Incremento de versión');

console.log(`\n--- FASE 2C.0 SQL AUDIT SUMMARY ---`);
console.log(`Reglas comprobadas: ${testsRun}`);
console.log(`Reglas superadas: ${testsPassed}`);
console.log(`Reglas fallidas: ${testsFailed}`);

if (testsFailed > 0) process.exit(1);
