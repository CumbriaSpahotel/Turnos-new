const { resolveDay } = require('../shift-resolver.js');

const employees = [
    { id: 'emp1', nombre: 'Empleado 1' },
    { id: 'emp2', nombre: 'Empleado 2' },
    { id: 'juan', nombre: 'Juan' },
    { id: 'pedro', nombre: 'Pedro' },
    { id: 'ausente', nombre: 'Ausente' }
];

const date = '2026-04-25';
const hotelA = 'Hotel A';
const hotelB = 'Hotel B';

const scenarios = [
    {
        name: '1. Normal',
        baseRows: [{ empleadoId: 'emp1', hotel: hotelA, turno: 'M' }],
        events: [],
        expected: {
            emp1: { turnoFinal: 'M', estadoFinal: 'TRABAJANDO', isModified: false }
        }
    },
    {
        name: '2. Vacaciones sin sust.',
        baseRows: [{ empleadoId: 'emp1', hotel: hotelA, turno: 'M' }],
        events: [{ tipo: 'VAC', empleado_id: 'emp1', fecha_inicio: date }],
        expected: {
            emp1: { turnoFinal: null, estadoFinal: 'VACACIONES', isModified: false, isAbsence: true }
        }
    },
    {
        name: '3. Vacaciones con sust.',
        baseRows: [
            { empleadoId: 'ausente', hotel: hotelA, turno: 'M' },
            { empleadoId: 'pedro', hotel: hotelA, turno: 'D' }
        ],
        events: [{ tipo: 'VAC', empleado_id: 'ausente', empleado_destino_id: 'pedro', fecha_inicio: date }],
        expected: {
            ausente: { turnoFinal: null, estadoFinal: 'VACACIONES', isAbsence: true, coveredByEmployeeId: 'pedro' },
            pedro: { turnoFinal: 'M', estadoFinal: 'TRABAJANDO', isModified: true, coversEmployeeId: 'ausente' }
        }
    },
    {
        name: '4. Baja con sust.',
        baseRows: [
            { empleadoId: 'ausente', hotel: hotelA, turno: 'T' },
            { empleadoId: 'juan', hotel: hotelA, turno: 'D' }
        ],
        events: [{ tipo: 'BAJA', empleado_id: 'ausente', empleado_destino_id: 'juan', fecha_inicio: date }],
        expected: {
            ausente: { turnoFinal: null, estadoFinal: 'BAJA', isAbsence: true, coveredByEmployeeId: 'juan' },
            juan: { turnoFinal: 'T', estadoFinal: 'TRABAJANDO', isModified: true, coversEmployeeId: 'ausente' }
        }
    },
    {
        name: '5. Cambio de Hotel',
        baseRows: [{ empleadoId: 'emp1', hotel: hotelA, turno: 'M' }],
        events: [{ tipo: 'CAMBIO_HOTEL', empleado_id: 'emp1', hotel_destino: hotelB, fecha_inicio: date }],
        expected: {
            emp1: { turnoFinal: 'M', hotelFinal: hotelB, estadoFinal: 'TRABAJANDO', isModified: true }
        }
    },
    {
        name: '6. Cambio de Turno',
        baseRows: [{ empleadoId: 'emp1', hotel: hotelA, turno: 'M' }],
        events: [{ tipo: 'CAMBIO_TURNO', empleado_id: 'emp1', turno_nuevo: 'T', fecha_inicio: date }],
        expected: {
            emp1: { turnoFinal: 'T', estadoFinal: 'TRABAJANDO', isModified: true }
        }
    },
    {
        name: '7. Intercambio',
        baseRows: [
            { empleadoId: 'emp1', hotel: hotelA, turno: 'M' },
            { empleadoId: 'emp2', hotel: hotelA, turno: 'T' }
        ],
        events: [{ tipo: 'INTERCAMBIO_TURNO', empleado_id: 'emp1', empleado_destino_id: 'emp2', fecha_inicio: date }],
        expected: {
            emp1: { turnoFinal: 'T', isModified: true },
            emp2: { turnoFinal: 'M', isModified: true }
        }
    },
    {
        name: '8. Cesión unilateral',
        baseRows: [
            { empleadoId: 'emp1', hotel: hotelA, turno: 'M' },
            { empleadoId: 'emp2', hotel: hotelA, turno: 'D' }
        ],
        events: [{ tipo: 'INTERCAMBIO_TURNO', empleado_id: 'emp1', empleado_destino_id: 'emp2', fecha_inicio: date }],
        expected: {
            emp1: { turnoFinal: 'D', isModified: true }, // Asume el descanso
            emp2: { turnoFinal: 'M', isModified: true }
        }
    },
    {
        name: '9. Refuerzo',
        baseRows: [{ empleadoId: 'emp1', hotel: hotelA, turno: 'D' }],
        events: [{ tipo: 'REFUERZO', empleado_id: 'emp1', turno_nuevo: 'N', fecha_inicio: date }],
        expected: {
            emp1: { turnoFinal: 'N', estadoFinal: 'TRABAJANDO', isModified: true }
        }
    },
    {
        name: '10. Combinación (Cambio + Baja)',
        baseRows: [{ empleadoId: 'emp1', hotel: hotelA, turno: 'M' }],
        events: [
            { tipo: 'CAMBIO_TURNO', empleado_id: 'emp1', turno_nuevo: 'T', fecha_inicio: date },
            { tipo: 'BAJA', empleado_id: 'emp1', fecha_inicio: date }
        ],
        expected: {
            emp1: { turnoFinal: null, estadoFinal: 'BAJA', isAbsence: true } // Baja prioriza sobre cambio turno
        }
    },
    {
        name: '11. Anulación',
        baseRows: [{ empleadoId: 'emp1', hotel: hotelA, turno: 'M' }],
        events: [{ tipo: 'CAMBIO_TURNO', empleado_id: 'emp1', turno_nuevo: 'T', fecha_inicio: date, estado: 'anulado' }],
        expected: {
            emp1: { turnoFinal: 'M', estadoFinal: 'TRABAJANDO', isModified: false }
        }
    }
];

let passed = 0;

scenarios.forEach(sc => {
    const stateMap = resolveDay({
        date,
        employees,
        baseRows: sc.baseRows,
        events: sc.events || [],
        manualOverrides: sc.manualOverrides || []
    });

    let ok = true;
    const errors = [];

    Object.keys(sc.expected).forEach(empId => {
        const state = stateMap.get(empId);
        if (!state) {
            ok = false;
            errors.push(`Falta el estado para ${empId}`);
            return;
        }
        
        Object.keys(sc.expected[empId]).forEach(key => {
            if (state[key] !== sc.expected[empId][key]) {
                ok = false;
                errors.push(`[${empId}].${key} esperaba '${sc.expected[empId][key]}' pero fue '${state[key]}'`);
            }
        });
    });

    if (ok) {
        passed++;
        console.log(`✅ ${sc.name}`);
    } else {
        console.log(`❌ ${sc.name}`);
        errors.forEach(e => console.log(`   - ${e}`));
    }
});

console.log(`\nResultados: ${passed} / ${scenarios.length} Passed`);
