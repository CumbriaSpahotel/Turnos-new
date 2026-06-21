const fs = require('fs');
const path = require('path');

// 1. Mock window and environment
global.window = {
    normalizeId: (id) => String(id || '').trim().toLowerCase()
};

const resolverCode = fs.readFileSync(path.join(__dirname, '../shift-resolver.js'), 'utf8');
eval(resolverCode);

// 2. Setup Data
const dateStr = '2026-06-19';

// Base Turnos Index (Federico has M-F shifts, Sandra has M-F shifts)
const baseIndex = {
    'emp-0013': { '2026-06-19': { code: 'M', origen: 'BASE' } }, // Federico
    'emp-0017': { '2026-06-19': { code: 'T', origen: 'BASE' } }  // Sandra
};

window.TurnosDB = { baseIndex };

// Events
const events = [
    {
        id: 'EV-VAC-FED',
        tipo: 'VAC',
        empleado_id: 'EMP-0013',
        empleado_destino_id: 'EMP-0017', // Sandra sustituye a Federico
        fecha_inicio: '2026-06-15',
        fecha_fin: '2026-06-21',
        estado: 'activo'
    },
    {
        id: 'EV-BAJA-SAN',
        tipo: 'BAJA',
        empleado_id: 'EMP-0017',
        empleado_destino_id: 'EMP-0013', // Federico cubre a Sandra
        fecha_inicio: '2026-06-19',
        fecha_fin: '2026-06-20',
        estado: 'activo'
    },
    {
        id: 'EV-INT-FED',
        tipo: 'INTERRUPCION_VAC',
        empleado_id: 'EMP-0013', // Aplica a Federico
        vacaciones_evento_id: 'EV-VAC-FED',
        incidencia_origen_id: 'EV-BAJA-SAN',
        fecha_inicio: '2026-06-19',
        fecha_fin: '2026-06-19',
        estado: 'activo',
        payload: {
            estado_operativo: 'activa',
            turnoSnapshot: {
                fecha: '2026-06-19',
                empleadoAusenteId: 'EMP-0017',
                empleadoSustitutoId: 'EMP-0013',
                turno: 'M', // Federico recupera el turno que Sandra le iba a cubrir (Sandra le iba a hacer la M, así que Federico vuelve a hacer su M... Espera, Sandra estaba cubriendo a Federico. El turno original de Federico era M.)
                origen: 'VAC-REVERTIDO',
                empleadoOrigenTurnoId: 'EMP-0013',
                eventoOrigenTurnoId: 'EV-VAC-FED',
                tipoAusenciaCubierta: 'BAJA'
            }
        }
    }
];

// Helper to provide events per date
window.eventoAplicaEnFecha = (ev, fecha) => {
    return ev.fecha_inicio <= fecha && (ev.fecha_fin || ev.fecha_inicio) >= fecha;
};
window.eventoPerteneceAEmpleado = (ev, empId) => {
    const id = window.normalizeId(empId);
    return window.normalizeId(ev.empleado_id) === id || window.normalizeId(ev.empleado_destino_id) === id;
};

window.getEmployeeTurnoBase = (empId, fecha, defaultIndex) => {
    const id = window.normalizeId(empId);
    return defaultIndex?.[id]?.[fecha];
};

// Test Federico
const resFed = window.resolveEmployeeDay({
    empleadoId: 'EMP-0013',
    fecha: dateStr,
    eventos: events,
    baseIndex: baseIndex
});

console.log("Federico's resolution:", JSON.stringify(resFed, null, 2));

// Test Sandra
const resSan = window.resolveEmployeeDay({
    empleadoId: 'EMP-0017',
    fecha: dateStr,
    eventos: events,
    baseIndex: baseIndex
});

console.log("Sandra's resolution:", JSON.stringify(resSan, null, 2));

if (resFed.turno === 'M' && resFed.origen === 'INTERRUPCION_VAC') {
    console.log("SUCCESS: Federico is covering Sandra's baja with his interrupted vacation snapshot.");
} else {
    console.error("FAIL: Federico resolution is incorrect.");
}

if (resSan.incidencia === 'BAJA') {
    console.log("SUCCESS: Sandra is absent due to baja.");
} else {
    console.error("FAIL: Sandra resolution is incorrect.");
}
