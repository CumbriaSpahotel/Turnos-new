// audit/phase2_dao.test.js
const fs = require('fs');
const assert = require('assert');

// Simulate the browser environment to load the module
const sandbox = {
    window: {
        ENABLE_EXPERIMENTAL_VACATION_CARRYOVER: false,
        supabase: {
            from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) })
        }
    },
    document: { querySelector: () => null }
};

const code = fs.readFileSync('./supabase-dao.js', 'utf8');
const fn = new Function('window', 'document', code);
fn(sandbox.window, sandbox.document);

const dao = sandbox.window.TurnosDB;

let testsRun = 0;
let testsPassed = 0;

function runTest(name, fn) {
    testsRun++;
    try {
        fn();
        testsPassed++;
        console.log(`[PASS] ${name}`);
    } catch (e) {
        console.error(`[FAIL] ${name}`, e.message);
    }
}

async function runAll() {
    // 1. fetchVacationYears with disabled flag
    await runTest('1. fetchVacationYears with FEATURE_DISABLED', async () => {
        sandbox.window.ENABLE_EXPERIMENTAL_VACATION_CARRYOVER = false;
        const res = await dao.fetchVacationYears('emp-1');
        assert.deepStrictEqual(res, { ok: false, enabled: false, code: 'FEATURE_DISABLED', data: [] });
    });

    // 2. fetchVacationAdjustments with disabled flag
    await runTest('2. fetchVacationAdjustments with FEATURE_DISABLED', async () => {
        sandbox.window.ENABLE_EXPERIMENTAL_VACATION_CARRYOVER = false;
        const res = await dao.fetchVacationAdjustments('vac-1');
        assert.deepStrictEqual(res, { ok: false, enabled: false, code: 'FEATURE_DISABLED', data: [] });
    });

    // 3. fetchVacationYears with enabled flag (mocks valid empty result)
    await runTest('3. fetchVacationYears with flag enabled', async () => {
        sandbox.window.ENABLE_EXPERIMENTAL_VACATION_CARRYOVER = true;
        const res = await dao.fetchVacationYears('emp-1');
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.enabled, true);
        assert.deepStrictEqual(res.data, []);
    });

    // 4. distinguish empty valid from FEATURE_DISABLED
    await runTest('4. Valid empty result is distinct from FEATURE_DISABLED', async () => {
        sandbox.window.ENABLE_EXPERIMENTAL_VACATION_CARRYOVER = true;
        const res = await dao.fetchVacationYears('emp-1');
        assert.strictEqual(res.ok, true);
        assert.notStrictEqual(res.code, 'FEATURE_DISABLED');
        assert.deepStrictEqual(res.data, []);
    });

    // 5. Supabase error returns ok: false, not empty array
    await runTest('5. Supabase error is exposed properly', async () => {
        sandbox.window.ENABLE_EXPERIMENTAL_VACATION_CARRYOVER = true;
        // Mock error
        const originalSupabase = sandbox.window.supabase;
        sandbox.window.supabase = {
            from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: new Error('Mock error') }) }) }) })
        };
        const res = await dao.fetchVacationYears('emp-1');
        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.error, 'Mock error');
        sandbox.window.supabase = originalSupabase; // restore
    });

    // 6. Readonly confirmation (no mutation methods)
    await runTest('6. No mutation methods exposed for Phase 2A', () => {
        assert.strictEqual(typeof dao.saveVacationAdjustment, 'undefined');
        assert.strictEqual(typeof dao.closeVacationYear, 'undefined');
    });

    console.log(`\n--- FASE 2A DAO TEST SUMMARY ---`);
    console.log(`Tests Run: ${testsRun}`);
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsRun - testsPassed}`);
    if (testsRun !== testsPassed) process.exit(1);
}

runAll();
