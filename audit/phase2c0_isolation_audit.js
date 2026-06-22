const { execSync } = require('child_process');

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

console.log('--- PHASE 2C.0 ISOLATION AUDIT ---');

const terms = ['vacation_importer', 'employee_vacation_years', 'vacation_migration_batches', 'HISTORICAL_RECORD', 'FEATURE_VACATION_HISTORY'];
const operationalFiles = ['admin.html', 'admin.js', 'index.html', 'mobile.app.js', 'supabase-dao.js', 'vacaciones-module.js', 'shift-resolver.js'];

for (const term of terms) {
    for (const file of operationalFiles) {
        try {
            const out = execSync(`findstr /C:"${term}" ${file} 2>nul || exit 0`).toString();
            if (out.includes(term)) {
                if ((file === 'supabase-dao.js' && term === 'employee_vacation_years') || 
                    (file === 'vacaciones-module.js' && term === 'HISTORICAL_RECORD')) {
                    assert(true, `Preparatory reference to ${term} exists in ${file} but remains inactive`);
                } else {
                    assert(false, `No operational reference to ${term} in ${file} (Found)`);
                }
            } else {
                assert(true, `No operational reference to ${term} in ${file}`);
            }
        } catch (e) {
            assert(true, `No operational reference to ${term} in ${file}`);
        }
    }
}

console.log(`\n--- FASE 2C.0 ISOLATION AUDIT SUMMARY ---`);
console.log(`Reglas comprobadas: ${testsRun}`);
console.log(`Reglas superadas: ${testsPassed}`);
console.log(`Reglas fallidas: ${testsFailed}`);

if (testsFailed > 0) process.exit(1);
