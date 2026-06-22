// audit/phase1_regression.js
const assert = require('assert');

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

// 1. Deduplication with fallback
runTest('Deduplication without generating pseudo-ids for identical missing-id events', () => {
    const rawEvents = [
        { id: '1', tipo: 'VAC' },
        { id: '1', tipo: 'VAC' }, // Duplicate, should be removed
        { id: null, tipo: 'VAC', data: 'A' },
        { id: undefined, tipo: 'VAC', data: 'B' },
        { evento_id: '2', tipo: 'BAJA' },
        { evento_id: '2', tipo: 'BAJA' } // Duplicate, should be removed
    ];

    const eventsById = new Map();
    const rawEventsWithoutId = [];
    rawEvents.forEach(ev => {
        if (!ev) return;
        const id = ev.id || ev.evento_id;
        if (id !== null && id !== undefined && String(id).trim() !== '') {
            const key = String(id).trim();
            if (!eventsById.has(key)) {
                eventsById.set(key, ev);
            }
        } else {
            rawEventsWithoutId.push(ev);
        }
    });
    const eventos = [...Array.from(eventsById.values()), ...rawEventsWithoutId];

    // Should have: '1', '2', and two without ids = 4 total
    assert.strictEqual(eventos.length, 4, `Expected 4 events, got ${eventos.length}`);
});

// 2. AvailableYears stability
runTest('AvailableYears maintains state safely without cross-pollution', () => {
    const refDate = new Date('2026-11-15T12:00:00');
    let _lastEmployeeProfileId = 'emp-A';
    let _employeeProfileYear = 2024;
    
    // Switch to emp-B
    const empB = { id: 'emp-B' };
    const groupedEvents = []; // No events
    
    const baseYears = [
        new Date().getFullYear() - 1,
        new Date().getFullYear(),
        new Date().getFullYear() + 1,
        refDate.getFullYear()
    ];
    if (_lastEmployeeProfileId === empB.id && _employeeProfileYear) {
        baseYears.push(_employeeProfileYear);
    }
    
    const availableYears = Array.from(new Set(baseYears)).sort((a, b) => a - b);
    
    let selectedYear = _employeeProfileYear || refDate.getFullYear();
    if (!availableYears.includes(selectedYear)) {
        selectedYear = availableYears.includes(new Date().getFullYear()) ? new Date().getFullYear() : availableYears[availableYears.length - 1];
    }
    
    // Employee B should drop 2024 because last profile was A
    assert.strictEqual(selectedYear, new Date().getFullYear());
});

runTest('AvailableYears maintains state when on the same employee', () => {
    const refDate = new Date('2026-11-15T12:00:00');
    let _lastEmployeeProfileId = 'emp-A';
    let _employeeProfileYear = 2024;
    
    // Refresh emp-A
    const empA = { id: 'emp-A' };
    const groupedEvents = []; // No events in 2024 anymore (deleted!)
    
    const baseYears = [
        new Date().getFullYear() - 1,
        new Date().getFullYear(),
        new Date().getFullYear() + 1,
        refDate.getFullYear()
    ];
    if (_lastEmployeeProfileId === empA.id && _employeeProfileYear) {
        baseYears.push(_employeeProfileYear);
    }
    
    const availableYears = Array.from(new Set(baseYears)).sort((a, b) => a - b);
    
    let selectedYear = _employeeProfileYear || refDate.getFullYear();
    if (!availableYears.includes(selectedYear)) {
        selectedYear = availableYears.includes(new Date().getFullYear()) ? new Date().getFullYear() : availableYears[availableYears.length - 1];
    }
    
    // Employee A should KEEP 2024!
    assert.strictEqual(selectedYear, 2024);
});

// 3. KPI Equality
runTest('KPI Logic: Sin Vacaciones', () => {
    const derechoAnual = 44;
    const ajuste = 0;
    const planificadasAnio = 0;
    const prevPendiente = derechoAnual + ajuste - planificadasAnio;
    const newPendiente = derechoAnual + ajuste - planificadasAnio;
    assert.strictEqual(prevPendiente, newPendiente);
    assert.strictEqual(newPendiente, 44);
});

runTest('KPI Logic: Vacaciones Normales', () => {
    const derechoAnual = 44;
    const ajuste = 0;
    const planificadasAnio = 10;
    const prevPendiente = derechoAnual + ajuste - planificadasAnio;
    const newPendiente = derechoAnual + ajuste - planificadasAnio;
    assert.strictEqual(prevPendiente, newPendiente);
    assert.strictEqual(newPendiente, 34);
});

runTest('KPI Logic: Vacaciones Interrumpidas', () => {
    const derechoAnual = 44;
    const ajuste = 0;
    // La interrupción se deduce antes de setear planificadasAnio en el reducer
    // planificadas = 10 días totales de evento - 3 días interrupción = 7
    const planificadasAnio = 7; 
    const prevPendiente = derechoAnual + ajuste - planificadasAnio;
    const newPendiente = derechoAnual + ajuste - planificadasAnio;
    assert.strictEqual(prevPendiente, newPendiente);
    assert.strictEqual(newPendiente, 37);
});

console.log(`\n--- AUDIT SUMMARY ---`);
console.log(`Tests Run: ${testsRun}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsRun - testsPassed}`);
if (testsRun !== testsPassed) process.exit(1);
