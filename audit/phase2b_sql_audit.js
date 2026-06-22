const fs = require('fs');

const sqlBatches = fs.readFileSync('database/migrations/02_phase2_migration_batches.sql', 'utf8');
const sqlRpcs = fs.readFileSync('database/migrations/03_phase2_migration_rpcs.sql', 'utf8');

let errors = 0;

console.log('--- PHASE 2B SQL AUDIT ---');

// 1. RLS cerrado por defecto
if (sqlBatches.includes('USING (false)') && sqlBatches.includes('WITH CHECK (false)')) {
    console.log('[PASS] RLS cerrado estricto presente para tablas de auditoría y roles.');
} else {
    console.error('[FAIL] Faltan restricciones RLS USING (false) WITH CHECK (false).');
    errors++;
}

// 2. RPC revocation
const funcs = ['begin_apply_vacation_batch', 'import_vacation_batch', 'mark_batch_failed', 'rollback_vacation_migration_batch', 'replace_migration_record'];
for (const fn of funcs) {
    if (sqlRpcs.includes(`REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC, anon, authenticated;`)) {
        console.log(`[PASS] Revoked EXECUTE on ${fn}`);
    } else {
        console.error(`[FAIL] Missing REVOKE EXECUTE on ${fn}`);
        errors++;
    }
}

// 3. Validar identidad
if (sqlRpcs.includes('v_actor_id := auth.uid()') && sqlRpcs.includes("RAISE EXCEPTION 'UNAUTHORIZED'")) {
    console.log('[PASS] Verificación de identidad humana con auth.uid() encontrada.');
} else {
    console.error('[FAIL] No se valida auth.uid() en los RPCs.');
    errors++;
}

// 4. No service_role fallback inside RPCs
if (sqlRpcs.includes("current_setting('role') = 'service_role'") || sqlRpcs.includes("service_role")) {
    console.error('[FAIL] Uso explícito de service_role detectado en SQL. Prohibido.');
    errors++;
} else {
    console.log('[PASS] No hay trust a service_role sin identidad en las RPCs.');
}

if (errors > 0) {
    console.error(`\n[FAIL] Auditoría estática fallida con ${errors} errores.`);
    process.exit(1);
} else {
    console.log(`\n[SUCCESS] Auditoría estática SQL de la Fase 2B superada correctamente.`);
}
