const fs = require('fs');
const path = require('path');

// Mock window and environment
global.window = {
    normalizeId: (id) => String(id || '').trim().toLowerCase()
};

const resolverCode = fs.readFileSync(path.join(__dirname, '../shift-resolver.js'), 'utf8');
eval(resolverCode);

// Base Turnos Index
const porEmpleadoFecha = new Map();
porEmpleadoFecha.set('emp-0013_2026-06-19', 'N'); // Federico (Tiene Noche)
const baseIndex = { porEmpleadoFecha };
window.TurnosDB = { baseIndex };

const events = [
    {
        id: 'EV-VAC-FED',
        tipo: 'VAC',
        empleado_id: 'EMP-0013', // Federico
        empleado_destino_id: 'EMP-0017', // Sandra sustituye a Federico
        fecha_inicio: '2026-06-15',
        fecha_fin: '2026-06-21',
        hotel_origen: 'Sercotel Guadiana',
        estado: 'activo'
    }
];

window.eventoAplicaEnFecha = (ev, fecha) => {
    return ev.fecha_inicio <= fecha && (ev.fecha_fin || ev.fecha_inicio) >= fecha;
};
window.eventoPerteneceAEmpleado = (ev, empId) => {
    const id = window.normalizeId(empId);
    return window.normalizeId(ev.empleado_id) === id || window.normalizeId(ev.empleado_destino_id) === id;
};
window.getTurnoBaseDeEmpleado = (empId, fecha, baseIdx) => {
    return baseIdx?.porEmpleadoFecha?.get(`${window.normalizeId(empId)}_${fecha}`);
};

const hotel = 'Sercotel Guadiana';
const empId = 'EMP-0017'; // Sandra
const sustId = 'EMP-0013'; // Federico
const fStr = '2026-06-19';
const todosLosEventos = events; // eventos ANTES de crear la baja

// SIMULAR ALGORITMO DE bajas-module.js
const normEmpId = window.normalizeId(empId);
const bIdx = baseIndex;

// Nivel 1
let res = window.resolveEmployeeDay({
    empleadoId: empId,
    fecha: fStr,
    eventos: todosLosEventos,
    baseIndex: bIdx,
    hotel: hotel
});

let turnoEfectivo = res && res.turno && res.turno !== '—' && res.turno !== '-' ? res.turno : null;
let empleadoOrigenTurnoId = res?.turnoOrigenEmpleadoId || res?.sustituyeA || empId;
let eventoOrigenTurnoId = res?.turnoOrigenEventoId || res?.evento_id || null;
let origenTxt = res?.origen || 'sustitucion_vacaciones';

// Nivel 2
if (!turnoEfectivo) {
    const coberturaActiva = todosLosEventos.find(e => 
        window.normalizeId(e.empleado_destino_id) === normEmpId &&
        window.eventoAplicaEnFecha(e, fStr) &&
        !/^(anulad|rechazad|cancelad)/i.test(e.estado||'') &&
        (e.hotel_origen || e.hotel_id || hotel) === hotel
    );
    
    if (coberturaActiva) {
        const evtTitular = coberturaActiva.empleado_id;
        turnoEfectivo = window.getTurnoBaseDeEmpleado(evtTitular, fStr, bIdx);
        empleadoOrigenTurnoId = evtTitular;
        eventoOrigenTurnoId = coberturaActiva.id;
        origenTxt = 'sustitucion_vacaciones';
    }
}

// Nivel 3
if (!turnoEfectivo) {
    turnoEfectivo = window.getTurnoBaseDeEmpleado(empId, fStr, bIdx);
    empleadoOrigenTurnoId = empId;
    eventoOrigenTurnoId = null;
    origenTxt = 'BASE';
}

if (!turnoEfectivo || turnoEfectivo === '—' || turnoEfectivo === '-') {
    console.error("FAIL: El empleado titular no tiene un turno resoluble. (Nivel 4 error)");
} else {
    console.log("ALGORITMO 4-NIVELES EXITOSO:");
    console.log("Turno Efectivo:", turnoEfectivo);
    console.log("Origen:", origenTxt);
    console.log("Empleado Origen:", empleadoOrigenTurnoId);
}

// Ahora simulamos el estado final con la baja y la interrupción
const eventsFinales = [
    ...events,
    {
        id: 'EV-BAJA-SAN',
        tipo: 'BAJA',
        empleado_id: 'EMP-0017', // Sandra causa BAJA
        empleado_destino_id: 'EMP-0013', // Federico cubre la baja
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
                fecha: fStr,
                empleadoAusenteId: empId,
                empleadoSustitutoId: sustId,
                turno: turnoEfectivo,
                origen: origenTxt,
                empleadoOrigenTurnoId: empleadoOrigenTurnoId,
                eventoOrigenTurnoId: eventoOrigenTurnoId,
                tipoAusenciaCubierta: 'BAJA'
            }
        }
    }
];

// Test Federico y Sandra con estado final
const resFed = window.resolveEmployeeDay({
    empleadoId: 'EMP-0013',
    fecha: '2026-06-19',
    eventos: eventsFinales,
    baseIndex: baseIndex
});
const resSan = window.resolveEmployeeDay({
    empleadoId: 'EMP-0017',
    fecha: '2026-06-19',
    eventos: eventsFinales,
    baseIndex: baseIndex
});

if (resFed.turno === 'N' && resFed.origen === 'INTERRUPCION_VAC' && window.normalizeId(resFed.coversEmployeeId) === 'emp-0017') {
    console.log("SUCCESS: Federico is covering Sandra's baja with Noche.");
} else {
    console.error("FAIL: Federico resolution is incorrect.", { turno: resFed.turno, origen: resFed.origen, covers: resFed.coversEmployeeId });
}

if (resSan.incidencia === 'BAJA' && resSan.coveredByEmployeeId === 'emp-0013') {
    console.log("SUCCESS: Sandra is absent due to baja covered by Federico.");
} else {
    console.error("FAIL: Sandra resolution is incorrect.");
}
