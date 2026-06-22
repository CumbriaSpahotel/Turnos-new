// audit/phase2_calculation.test.js
const fs = require('fs');
const assert = require('assert');

// Simulate the browser environment to load the module
const sandbox = {
    window: {},
    document: { querySelector: () => null }
};

// Evaluate the file code
const code = fs.readFileSync('./vacaciones-module.js', 'utf8');
const fn = new Function('window', 'document', code);
fn(sandbox.window, sandbox.document);

const calculateBalance = sandbox.window.calculateEmployeeVacationBalance;

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

// Helpers
const employee = { id: 'emp-1', nombre: 'Carlos', vacaciones_anuales: 44, ajuste_vacaciones_dias: 2 };
const year = new Date().getFullYear(); // Using current year so "future" vs "past" can be tested depending on hoy
const hoy = new Date().toISOString().split('T')[0];

const pastDate = `${year}-01-05`;
const pastDateEnd = `${year}-01-10`; // 6 days
const futureDate = `${year}-11-01`;
const futureDateEnd = `${year}-11-05`; // 5 days

// 1. Fallback legado sin registro
runTest('1. Fallback legado idéntico al actual', () => {
    const res = calculateBalance({ employee, events: [], year });
    assert.strictEqual(res.source, 'LEGACY');
    assert.strictEqual(res.annualEntitlement, 44);
    assert.strictEqual(res.adjustmentsTotal, 2);
    assert.strictEqual(res.currentBalance, 46); // 0 + 44 + 2 - 0
});

// 2. Registro histórico con saldo inicial positivo
runTest('2. Registro histórico con saldo inicial positivo', () => {
    const vacationYearRecord = { opening_balance_days: 5, annual_entitlement_days: 30 };
    const res = calculateBalance({ employee, events: [], year, vacationYearRecord });
    assert.strictEqual(res.source, 'HISTORICAL_RECORD');
    assert.strictEqual(res.openingBalance, 5);
    assert.strictEqual(res.annualEntitlement, 30);
    assert.strictEqual(res.currentBalance, 35);
});

// 3. Registro histórico con saldo inicial negativo
runTest('3. Registro histórico con saldo inicial negativo', () => {
    const vacationYearRecord = { opening_balance_days: -3, annual_entitlement_days: 44 };
    const res = calculateBalance({ employee, events: [], year, vacationYearRecord });
    assert.strictEqual(res.currentBalance, 41);
});

// 4. Exclusión del ajuste legado cuando existe registro histórico
runTest('4. Exclusión del ajuste legado con registro histórico', () => {
    const vacationYearRecord = { opening_balance_days: 0, annual_entitlement_days: 44 };
    const res = calculateBalance({ employee, events: [], year, vacationYearRecord });
    assert.strictEqual(res.adjustmentsTotal, 0); // Must ignore employee.ajuste_vacaciones_dias
});

// 5. Suma de varios ajustes vigentes
runTest('5. Suma de varios ajustes vigentes', () => {
    const vacationYearRecord = { opening_balance_days: 0, annual_entitlement_days: 44 };
    const adjustments = [
        { days: 2, reversed_at: null },
        { days: -1, reversed_at: null }
    ];
    const res = calculateBalance({ employee, events: [], year, vacationYearRecord, adjustments });
    assert.strictEqual(res.adjustmentsTotal, 1);
    assert.strictEqual(res.currentBalance, 45);
});

// 6. Exclusión de ajustes revertidos
runTest('6. Exclusión de ajustes revertidos', () => {
    const vacationYearRecord = { opening_balance_days: 0, annual_entitlement_days: 44 };
    const adjustments = [
        { days: 5, reversed_at: new Date().toISOString() }, // Ignored
        { days: 2, reversed_at: null }
    ];
    const res = calculateBalance({ employee, events: [], year, vacationYearRecord, adjustments });
    assert.strictEqual(res.adjustmentsTotal, 2);
});

// 7. Vacaciones normales (pasadas)
runTest('7. Vacaciones normales', () => {
    const events = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: pastDate, fecha_fin: pastDateEnd }];
    const res = calculateBalance({ employee, events, year });
    assert.strictEqual(res.enjoyedDays, 6); // 05 to 10 inclusive
    assert.strictEqual(res.currentBalance, 40); // 46 - 6
});

// 8. Vacaciones anuladas
runTest('8. Vacaciones anuladas', () => {
    const events = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'anulada', fecha_inicio: pastDate, fecha_fin: pastDateEnd }];
    const res = calculateBalance({ employee, events, year });
    assert.strictEqual(res.cancelledDays, 6);
    assert.strictEqual(res.enjoyedDays, 0);
    assert.strictEqual(res.currentBalance, 46);
});

// 9. Interrupción parcial
runTest('9. Interrupción parcial', () => {
    const events = [
        { id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: pastDate, fecha_fin: pastDateEnd },
        { id: 'int1', tipo: 'INTERRUPCION_VAC', estado: 'activo', fecha_inicio: pastDate, vacaciones_evento_id: 'v1' },
        { id: 'int2', tipo: 'INTERRUPCION_VAC', estado: 'activo', fecha_inicio: pastDateEnd, payload: { vacaciones_evento_id: 'v1' } }
    ];
    const res = calculateBalance({ employee, events, year });
    assert.strictEqual(res.interruptedDays, 2);
    assert.strictEqual(res.enjoyedDays, 4); // 6 - 2
});

// 10. Interrupción total
runTest('10. Interrupción total', () => {
    const events = [
        { id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: pastDate, fecha_fin: pastDate } // 1 day
    ];
    // Create an interruption for every day (just 1)
    events.push({ id: 'int1', tipo: 'INTERRUPCION_VAC', estado: 'activo', fecha_inicio: pastDate, vacaciones_evento_id: 'v1' });
    
    const res = calculateBalance({ employee, events, year });
    assert.strictEqual(res.interruptedDays, 1);
    assert.strictEqual(res.enjoyedDays, 0);
});

// 11. Evento que cruza diciembre y enero
runTest('11. Evento que cruza diciembre y enero', () => {
    const events = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: `${year-1}-12-29`, fecha_fin: `${year}-01-04` }];
    const res = calculateBalance({ employee, events, year });
    assert.strictEqual(res.enjoyedDays, 4); // Jan 1st to 4th inclusive = 4 days
});

// 12. Planificadas futuras
runTest('12. Planificadas futuras', () => {
    // If we pretend hoy is mid-year, futureDate is November
    const events = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: futureDate, fecha_fin: futureDateEnd }];
    const res = calculateBalance({ employee, events, year });
    assert.strictEqual(res.enjoyedDays, 0);
    assert.strictEqual(res.plannedFutureDays, 5);
    assert.strictEqual(res.currentBalance, 46);
    assert.strictEqual(res.projectedBalance, 41);
});

// 13. Año sin eventos
runTest('13. Año sin eventos', () => {
    const res = calculateBalance({ employee, events: [], year });
    assert.strictEqual(res.enjoyedDays, 0);
    assert.strictEqual(res.projectedBalance, 46);
});

// 14. Inmutabilidad del objeto de entrada
runTest('14. Inmutabilidad del objeto de entrada', () => {
    const events = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: pastDate, fecha_fin: pastDateEnd }];
    const eventsCopy = JSON.parse(JSON.stringify(events));
    calculateBalance({ employee, events, year });
    assert.deepStrictEqual(events, eventsCopy);
});

// 15. Resultado determinista
runTest('15. Resultado determinista', () => {
    const events = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: pastDate, fecha_fin: pastDateEnd }];
    const res1 = calculateBalance({ employee, events, year });
    const res2 = calculateBalance({ employee, events, year });
    assert.deepStrictEqual(res1, res2);
});

// Helpers for parity table
const parityResults = [];
function recordParity(caso, legacy, nuevo) {
    parityResults.push({ caso, legacy, nuevo, diff: nuevo - legacy });
}

// 16. Paridad exacta con el cálculo actual cuando source = LEGACY
runTest('16. Paridad exacta - Múltiples escenarios', () => {
    // Escenario 1: Sin vacaciones
    const res1L = calculateBalance({ employee, events: [], year, vacationYearRecord: null, referenceDate: pastDate });
    const res1N = calculateBalance({ employee, events: [], year, vacationYearRecord: { opening_balance_days: 0, annual_entitlement_days: 44 }, adjustments: [{days:2}], referenceDate: pastDate });
    recordParity('Sin vacaciones', res1L.currentBalance, res1N.currentBalance);

    // Escenario 2: Vacaciones normales
    const ev2 = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: pastDate, fecha_fin: pastDateEnd }];
    const res2L = calculateBalance({ employee, events: ev2, year, vacationYearRecord: null, referenceDate: pastDateEnd });
    const res2N = calculateBalance({ employee, events: ev2, year, vacationYearRecord: { opening_balance_days: 0, annual_entitlement_days: 44 }, adjustments: [{days:2}], referenceDate: pastDateEnd });
    recordParity('Vacaciones normales', res2L.currentBalance, res2N.currentBalance);

    // Escenario 3: Interrupción parcial
    const ev3 = [
        { id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: pastDate, fecha_fin: pastDateEnd },
        { id: 'i1', tipo: 'INTERRUPCION_VAC', estado: 'activo', fecha_inicio: pastDate, vacaciones_evento_id: 'v1' },
        { id: 'i2', tipo: 'INTERRUPCION_VAC', estado: 'activo', fecha_inicio: pastDateEnd, vacaciones_evento_id: 'v1' }
    ];
    const res3L = calculateBalance({ employee, events: ev3, year, vacationYearRecord: null, referenceDate: pastDateEnd });
    const res3N = calculateBalance({ employee, events: ev3, year, vacationYearRecord: { opening_balance_days: 0, annual_entitlement_days: 44 }, adjustments: [{days:2}], referenceDate: pastDateEnd });
    recordParity('Interrupción parcial', res3L.currentBalance, res3N.currentBalance);

    // Escenario 4: Interrupción total
    const ev4 = [
        { id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: pastDate, fecha_fin: pastDate },
        { id: 'i1', tipo: 'INTERRUPCION_VAC', estado: 'activo', fecha_inicio: pastDate, vacaciones_evento_id: 'v1' }
    ];
    const res4L = calculateBalance({ employee, events: ev4, year, vacationYearRecord: null, referenceDate: pastDateEnd });
    const res4N = calculateBalance({ employee, events: ev4, year, vacationYearRecord: { opening_balance_days: 0, annual_entitlement_days: 44 }, adjustments: [{days:2}], referenceDate: pastDateEnd });
    recordParity('Interrupción total', res4L.currentBalance, res4N.currentBalance);

    // Escenario 5: Anulada
    const ev5 = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'anulada', fecha_inicio: pastDate, fecha_fin: pastDateEnd }];
    const res5L = calculateBalance({ employee, events: ev5, year, vacationYearRecord: null, referenceDate: pastDateEnd });
    const res5N = calculateBalance({ employee, events: ev5, year, vacationYearRecord: { opening_balance_days: 0, annual_entitlement_days: 44 }, adjustments: [{days:2}], referenceDate: pastDateEnd });
    recordParity('Anulada', res5L.currentBalance, res5N.currentBalance);

    // Escenario 6: Ajuste positivo
    recordParity('Ajuste positivo', res1L.currentBalance, res1N.currentBalance);

    // Escenario 7: Ajuste negativo
    const empNeg = { ...employee, ajuste_vacaciones_dias: -3 };
    const res7L = calculateBalance({ employee: empNeg, events: [], year, vacationYearRecord: null, referenceDate: pastDateEnd });
    const res7N = calculateBalance({ employee: empNeg, events: [], year, vacationYearRecord: { opening_balance_days: 0, annual_entitlement_days: 44 }, adjustments: [{days:-3}], referenceDate: pastDateEnd });
    recordParity('Ajuste negativo', res7L.currentBalance, res7N.currentBalance);

    // Escenario 8: Cruce de año
    const ev8 = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: `${year-1}-12-29`, fecha_fin: `${year}-01-04` }];
    const res8L = calculateBalance({ employee, events: ev8, year, vacationYearRecord: null, referenceDate: `${year}-01-05` });
    const res8N = calculateBalance({ employee, events: ev8, year, vacationYearRecord: { opening_balance_days: 0, annual_entitlement_days: 44 }, adjustments: [{days:2}], referenceDate: `${year}-01-05` });
    recordParity('Cruce de año', res8L.currentBalance, res8N.currentBalance);

    // Escenario 9: Año sin eventos
    recordParity('Año sin eventos', res1L.currentBalance, res1N.currentBalance);

    // Escenario 10: Futuras planificadas
    const ev10 = [{ id: 'v1', empleado_id: 'emp-1', tipo: 'VAC', estado: 'activo', fecha_inicio: futureDate, fecha_fin: futureDateEnd }];
    // referenceDate is pastDate, meaning the vacation is in the future
    const res10L = calculateBalance({ employee, events: ev10, year, vacationYearRecord: null, referenceDate: pastDate });
    const res10N = calculateBalance({ employee, events: ev10, year, vacationYearRecord: { opening_balance_days: 0, annual_entitlement_days: 44 }, adjustments: [{days:2}], referenceDate: pastDate });
    recordParity('Futuras planificadas', res10L.projectedBalance, res10N.projectedBalance);

    parityResults.forEach(r => assert.strictEqual(r.diff, 0, `Parity failed for ${r.caso}`));
});

console.log(`\n--- FASE 2A TEST SUMMARY ---`);
console.log(`Tests Run: ${testsRun}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsRun - testsPassed}`);

console.log(`\n--- TABLA DE PARIDAD LEGACY ---`);
console.log(`| Caso                 |     Legado real |      Nuevo real | Diferencia |`);
console.log(`| -------------------- | --------------: | --------------: | ---------: |`);
parityResults.forEach(r => {
    console.log(`| ${r.caso.padEnd(20)} | ${String(r.legacy).padStart(15)} | ${String(r.nuevo).padStart(15)} | ${String(r.diff).padStart(10)} |`);
});

if (testsRun !== testsPassed) process.exit(1);
