/**
 * test_engine_v3.js
 * Validación comparativa de Engine v3.0 (con ShiftResolver integrado)
 * 
 * Escenarios reales:
 *   - Cristina / Miriam (intercambio de turno)
 *   - Dani / Macarena (sustitución por vacaciones)
 *   - Vacaciones sin sustituto
 *   - Baja / Permiso
 *   - Cambio de hotel
 *
 * Modo: Node.js puro (sin browser DOM).
 */

// ── Shims de browser para Node.js ─────────────────────────────────────────
global.window = {
    _debugTurnos: false,
    TurnosRules: {
        isAbsenceType: (tipo) => {
            const t = String(tipo || '').toUpperCase();
            return t.startsWith('VAC') || t.startsWith('BAJA') || t.startsWith('PERM');
        },
        isCtType: (tipo) => String(tipo || '').toUpperCase().includes('CT'),
        shiftKey: (turno, type = 'NORMAL') => {
            const t = String(type || 'NORMAL').toUpperCase();
            if (t.startsWith('VAC')) return 'v';
            if (t.startsWith('BAJA')) return 'b';
            if (t.startsWith('PERM')) return 'p';
            const text = String(turno || '').toLowerCase();
            if (!text) return '';
            if (text.startsWith('m')) return 'm';
            if (text.startsWith('t')) return 't';
            if (text.startsWith('n')) return 'n';
            if (text.startsWith('d')) return 'd';
            return '';
        }
    }
};

// Cargar módulos
require('../shift-resolver.js');
require('../turnos-engine.js');

const { resolveDay } = global.window.ShiftResolver;
const { adaptFinalStateToCell } = global.window.TurnosEngine;

// ── Utilidad de test ──────────────────────────────────────────────────────
let passed = 0, total = 0;

function check(label, actual, expected, context = '') {
    total++;
    let ok = true;
    const errors = [];
    Object.keys(expected).forEach(key => {
        if (actual[key] !== expected[key]) {
            ok = false;
            errors.push(`  ${key}: esperado='${expected[key]}' obtenido='${actual[key]}'`);
        }
    });
    if (ok) {
        passed++;
        console.log(`  ✅ ${label}`);
    } else {
        console.log(`  ❌ ${label}${context ? ` [${context}]` : ''}`);
        errors.forEach(e => console.log(e));
    }
}

function runScenario(name, fn) {
    console.log(`\n══ ${name} ══`);
    fn();
}

const employees = [
    { id: 'cristina',  nombre: 'Cristina'  },
    { id: 'miriam',    nombre: 'Miriam'    },
    { id: 'dani',      nombre: 'Dani'      },
    { id: 'macarena',  nombre: 'Macarena'  },
    { id: 'emp_solo',  nombre: 'EmpSolo'   }
];

const date    = '2026-04-25';
const hotelA  = 'Cumbria Spa&Hotel';
const hotelB  = 'Sercotel Guadiana';


// ═══════════════════════════════════════════════════════════════════════════
// ESCENARIO 1: Cristina / Miriam — Intercambio de turno
// Cristina tiene Mañana, Miriam tiene Tarde.
// Evento INTERCAMBIO_TURNO: Cristina ↔ Miriam
// Resultado: Cristina queda con Tarde 🔄, Miriam con Mañana 🔄
// ═══════════════════════════════════════════════════════════════════════════
runScenario('Cristina / Miriam — Intercambio de turno', () => {
    const stateMap = resolveDay({
        date,
        employees,
        baseRows: [
            { empleadoId: 'cristina', hotel: hotelA, turno: 'M' },
            { empleadoId: 'miriam',   hotel: hotelA, turno: 'T' }
        ],
        events: [{
            tipo: 'INTERCAMBIO_TURNO',
            empleado_id: 'cristina',
            empleado_destino_id: 'miriam',
            fecha_inicio: date,
            fecha_fin: date
        }],
        manualOverrides: []
    });

    const sCristina = stateMap.get('cristina');
    const sMiriam   = stateMap.get('miriam');

    check('Cristina.turnoFinal = T', sCristina, { turnoFinal: 'T', isModified: true, estadoFinal: 'TRABAJANDO' });
    check('Miriam.turnoFinal = M',   sMiriam,   { turnoFinal: 'M', isModified: true, estadoFinal: 'TRABAJANDO' });

    // Verificar adaptador: la celda legacy debe tener tipo=CT (para icono 🔄)
    const cellCristina = adaptFinalStateToCell(sCristina);
    const cellMiriam   = adaptFinalStateToCell(sMiriam);
    check('Cristina.cell.tipo = CT', cellCristina, { tipo: 'CT', turno: 'T' });
    check('Miriam.cell.tipo = CT',   cellMiriam,   { tipo: 'CT', turno: 'M' });
});


// ═══════════════════════════════════════════════════════════════════════════
// ESCENARIO 2: Dani / Macarena — Sustitución por vacaciones
// Dani está de Vacaciones (base: Mañana). Macarena le cubre (base: Descanso).
// Resultado: Dani→VACACIONES/null, Macarena→TRABAJANDO/Mañana 🔄
// ═══════════════════════════════════════════════════════════════════════════
runScenario('Dani / Macarena — Sustitución por vacaciones', () => {
    const stateMap = resolveDay({
        date,
        employees,
        baseRows: [
            { empleadoId: 'dani',     hotel: hotelA, turno: 'M' },
            { empleadoId: 'macarena', hotel: hotelA, turno: 'D' }
        ],
        events: [{
            tipo: 'VAC',
            empleado_id: 'dani',
            empleado_destino_id: 'macarena',
            fecha_inicio: date,
            fecha_fin: date
        }],
        manualOverrides: []
    });

    const sDani     = stateMap.get('dani');
    const sMacarena = stateMap.get('macarena');

    check('Dani.estadoFinal = VACACIONES', sDani, {
        turnoFinal: null, estadoFinal: 'VACACIONES', isAbsence: true, coveredByEmployeeId: 'macarena'
    });
    check('Macarena hereda turno M y cubre a Dani', sMacarena, {
        turnoFinal: 'M', estadoFinal: 'TRABAJANDO', isModified: true, coversEmployeeId: 'dani'
    });

    const cellDani     = adaptFinalStateToCell(sDani);
    const cellMacarena = adaptFinalStateToCell(sMacarena);
    check('Dani.cell.turno = ""',          cellDani,     { turno: '' });
    check('Macarena.cell.tipo = CT',       cellMacarena, { tipo: 'CT', turno: 'M' });
    check('Macarena.cell.coveringFor',     cellMacarena, { coveringFor: 'dani' });
});


// ═══════════════════════════════════════════════════════════════════════════
// ESCENARIO 3: Vacaciones sin sustituto
// emp_solo de Tarde, VAC sin destino.
// Resultado: turnoFinal=null, estadoFinal=VACACIONES, coveredByEmployeeId=null
// ═══════════════════════════════════════════════════════════════════════════
runScenario('Vacaciones sin sustituto', () => {
    const stateMap = resolveDay({
        date,
        employees,
        baseRows: [{ empleadoId: 'emp_solo', hotel: hotelA, turno: 'T' }],
        events: [{
            tipo: 'VAC',
            empleado_id: 'emp_solo',
            fecha_inicio: date,
            fecha_fin: date
        }],
        manualOverrides: []
    });

    const s = stateMap.get('emp_solo');
    check('Sin sustituto: VAC correcta', s, {
        turnoFinal: null, estadoFinal: 'VACACIONES', isAbsence: true,
        coveredByEmployeeId: null, coversEmployeeId: null
    });
});


// ═══════════════════════════════════════════════════════════════════════════
// ESCENARIO 4: Baja / Permiso
// BAJA sin sustituto, PERM con sustituto (Miriam cubre a Dani)
// ═══════════════════════════════════════════════════════════════════════════
runScenario('Baja sin sustituto / Permiso con sustituto', () => {
    // 4a: Baja sin sustituto
    const mapBaja = resolveDay({
        date, employees,
        baseRows: [{ empleadoId: 'emp_solo', hotel: hotelA, turno: 'N' }],
        events: [{ tipo: 'BAJA', empleado_id: 'emp_solo', fecha_inicio: date, fecha_fin: date }],
        manualOverrides: []
    });
    const sBaja = mapBaja.get('emp_solo');
    check('BAJA: estadoFinal=BAJA, sin turno, sin cobertura', sBaja, {
        turnoFinal: null, estadoFinal: 'BAJA', isAbsence: true, coveredByEmployeeId: null
    });

    // 4b: Permiso con sustituto
    const mapPerm = resolveDay({
        date, employees,
        baseRows: [
            { empleadoId: 'dani',   hotel: hotelA, turno: 'M' },
            { empleadoId: 'miriam', hotel: hotelA, turno: 'D' }
        ],
        events: [{
            tipo: 'PERM',
            empleado_id: 'dani',
            empleado_destino_id: 'miriam',
            fecha_inicio: date,
            fecha_fin: date
        }],
        manualOverrides: []
    });
    const sDaniPerm   = mapPerm.get('dani');
    const sMiriamPerm = mapPerm.get('miriam');
    check('PERM: Dani en permiso, cubierto por Miriam', sDaniPerm, {
        turnoFinal: null, estadoFinal: 'PERM', isAbsence: true, coveredByEmployeeId: 'miriam'
    });
    check('PERM: Miriam cubre turno M de Dani', sMiriamPerm, {
        turnoFinal: 'M', isModified: true, coversEmployeeId: 'dani'
    });
});


// ═══════════════════════════════════════════════════════════════════════════
// ESCENARIO 5: Cambio de hotel
// Cristina (base: Hotel A, Mañana) → evento CAMBIO_HOTEL al Hotel B
// Resultado: hotelFinal=Hotel B, turnoFinal=M, isModified=true
// ═══════════════════════════════════════════════════════════════════════════
runScenario('Cambio de hotel', () => {
    const stateMap = resolveDay({
        date, employees,
        baseRows: [{ empleadoId: 'cristina', hotel: hotelA, turno: 'M' }],
        events: [{
            tipo: 'CAMBIO_HOTEL',
            empleado_id: 'cristina',
            hotel_destino: hotelB,
            fecha_inicio: date,
            fecha_fin: date
        }],
        manualOverrides: []
    });

    const s = stateMap.get('cristina');
    check('Cristina: hotel cambia a B, turno se mantiene M', s, {
        turnoFinal: 'M', hotelFinal: hotelB, isModified: true, estadoFinal: 'TRABAJANDO'
    });
    const cell = adaptFinalStateToCell(s);
    check('Adaptador: tipo=CT, hotel_id=Hotel B', cell, { tipo: 'CT', hotel_id: hotelB, turno: 'M' });
});


// ═══════════════════════════════════════════════════════════════════════════
// ESCENARIO 6: Legacy CT manual (sin evento_id) — override legacy
// Miriam tiene base M. La tabla turnos tiene una fila CT con turno='T' sin evento_id.
// Resultado: turnoFinal=T, isModified=true, sourceReason=INTERCAMBIO_MANUAL o OVERRIDE_MANUAL
// ═══════════════════════════════════════════════════════════════════════════
runScenario('Legacy CT manual (sin evento_id)', () => {
    const stateMap = resolveDay({
        date, employees,
        baseRows: [{ empleadoId: 'miriam', hotel: hotelA, turno: 'M' }],
        events: [],
        manualOverrides: [{
            empleado_id: 'miriam',
            fecha: date,
            turno: 'T',
            tipo: 'CT',
            sustituto: null,
            evento_id: null
        }]
    });

    const s = stateMap.get('miriam');
    check('Legacy CT: turnoFinal resuelto al turno explícito T', s, {
        turnoFinal: 'T', isModified: true, isAbsence: false
    });
});


// ═══════════════════════════════════════════════════════════════════════════
// ESCENARIO 7: Cesión unilateral (Intercambio con Descanso)
// Cristina M, Miriam D. Intercambio. Cristina queda con D, Miriam con M.
// ═══════════════════════════════════════════════════════════════════════════
runScenario('Cesión unilateral (Mañana ↔ Descanso)', () => {
    const stateMap = resolveDay({
        date, employees,
        baseRows: [
            { empleadoId: 'cristina', hotel: hotelA, turno: 'M' },
            { empleadoId: 'miriam',   hotel: hotelA, turno: 'D' }
        ],
        events: [{
            tipo: 'INTERCAMBIO_TURNO',
            empleado_id: 'cristina',
            empleado_destino_id: 'miriam',
            fecha_inicio: date,
            fecha_fin: date
        }],
        manualOverrides: []
    });

    const sCristina = stateMap.get('cristina');
    const sMiriam   = stateMap.get('miriam');

    // Cristina cede su Mañana → se queda con el Descanso de Miriam
    check('Cristina recibe Descanso de Miriam', sCristina, {
        turnoFinal: null, estadoFinal: 'DESCANSO', isModified: true
    });
    // Miriam recibe la Mañana de Cristina
    check('Miriam recibe Mañana de Cristina', sMiriam, {
        turnoFinal: 'M', estadoFinal: 'TRABAJANDO', isModified: true
    });
});


// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`Resultado final: ${passed} / ${total} Passed`);
if (passed < total) {
    console.log(`⚠️  ${total - passed} scenario(s) FALLARON. Revisar antes de integrar en producción.`);
    process.exit(1);
} else {
    console.log('✅ Todos los escenarios superados. Engine v3.0 listo para integración.');
    process.exit(0);
}
