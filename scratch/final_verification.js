
// FINAL VERIFICATION SCRIPT (V140)
global.window = {};
window.normalizeId = (id) => String(id || '').toLowerCase().trim();
window.normalizeDate = (d) => String(d || '').slice(0, 10);
window.normalizeTipo = (t) => String(t || '').toUpperCase().trim();
window.normalizeEstado = (e) => String(e || 'activo').toLowerCase().trim();
window.eventoAplicaEnFecha = (ev, date) => {
    const fi = window.normalizeDate(ev.fecha_inicio);
    const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
    return date >= fi && date <= ff;
};
window.eventoPerteneceAHotel = (ev, hotel) => true;
window.eventoPerteneceAEmpleado = (ev, empId) => {
    const normId = window.normalizeId(empId);
    const tId = window.normalizeId(ev.empleado_id || ev.titular_id || ev.participante_a);
    const sId = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id || ev.participante_b);
    return tId === normId || sId === normId;
};
window.isTitularOfAbsence = (ev, empId) => {
    return window.normalizeId(ev.empleado_id || ev.titular_id || ev.participante_a) === window.normalizeId(empId);
};
window.getTurnoBaseDeEmpleado = (empId, date) => {
    const norm = window.normalizeId(empId);
    if (norm === 'diana') return 'M';
    if (norm === 'dani') return 'T';
    return 'D';
};
window.getTurnoOperativoBase = (empId, date, context) => {
    return window.getTurnoBaseDeEmpleado(empId, date);
};

// THE NEW HELPER
window.getOperationalOccupant = (empId, date, events, hotel, context = {}) => {
    const normId = window.normalizeId(empId);
    if (!normId) return null;
    
    // Use maps if provided
    if (context.operationalOccupantByOriginalEmployeeId) {
        const dayMap = context.operationalOccupantByOriginalEmployeeId.get(date);
        if (dayMap && dayMap.has(normId)) {
            return window.getOperationalOccupant(dayMap.get(normId), date, events, hotel, context);
        }
        return normId;
    }

    const ev = events.find(e => 
        window.normalizeEstado(e.estado) !== 'anulado' &&
        window.eventoAplicaEnFecha(e, date) &&
        window.isTitularOfAbsence(e, normId) &&
        ['VAC', 'BAJA', 'SUSTITUCION'].includes(window.normalizeTipo(e.tipo)) &&
        (e.empleado_destino_id || e.sustituto_id)
    );
    if (ev) {
        const sustId = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id);
        if (sustId && sustId !== normId) {
            return window.getOperationalOccupant(sustId, date, events, hotel, context);
        }
    }
    return normId;
};

// THE UPDATED RESOLVER
window.resolveEmployeeDay = ({ empleadoId, fecha, eventos = [], baseIndex = {} }) => {
    const empId = window.normalizeId(empleadoId);
    const date = window.normalizeDate(fecha);
    const hotel = 'guadiana';

    const result = {
        empleadoId: empId,
        fecha: date,
        turno: window.getTurnoBaseDeEmpleado(empId, date) || '—',
        incidencia: null,
        cambio: false,
        sustituyeA: null,
        incidenciaCubierta: null
    };

    // 1. Identificar si soy sustituto
    const titularsSubstitutedByMe = [];
    eventos.forEach(ev => {
        if (!window.eventoAplicaEnFecha(ev, date)) return;
        const destId = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id);
        if (destId === empId) {
            const titularId = window.normalizeId(ev.empleado_id || ev.titular_id);
            if (titularId && titularId !== empId) titularsSubstitutedByMe.push(titularId);
        }
    });

    // 2. Filtrar eventos (incluyendo los de mis titulares)
    let eventosActivos = eventos.filter(ev => {
        if (!window.eventoAplicaEnFecha(ev, date)) return false;
        if (window.eventoPerteneceAEmpleado(ev, empId)) return true;
        const tipo = window.normalizeTipo(ev.tipo);
        if (tipo === 'CAMBIO_TURNO' || tipo === 'INTERCAMBIO_TURNO') {
            return titularsSubstitutedByMe.some(tId => window.eventoPerteneceAEmpleado(ev, tId));
        }
        return false;
    });

    // Sort by priority... (skipped here for simplicity)

    for (const ev of eventosActivos) {
        const tipo = window.normalizeTipo(ev.tipo);
        if (['VAC', 'BAJA'].includes(tipo) && window.isTitularOfAbsence(ev, empId)) {
            result.incidencia = tipo;
            result.turno = null;
            break;
        }
        if (['VAC', 'BAJA', 'SUSTITUCION'].includes(tipo) && !window.isTitularOfAbsence(ev, empId)) {
            const tId = window.normalizeId(ev.empleado_id || ev.titular_id);
            result.sustituyeA = tId;
            result.incidenciaCubierta = tipo;
            result.turno = window.getTurnoBaseDeEmpleado(tId, date);
            continue;
        }
        if (tipo === 'INTERCAMBIO_TURNO' || tipo === 'CAMBIO_TURNO') {
            const requestedA = window.normalizeId(ev.empleado_id || ev.titular_id);
            const requestedB = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id);
            
            const resolvedA = window.getOperationalOccupant(requestedA, date, eventos, hotel, { baseIndex });
            const resolvedB = window.getOperationalOccupant(requestedB, date, eventos, hotel, { baseIndex });

            const isOrigin = empId === resolvedA;
            const isDestination = empId === resolvedB;

            if (!isOrigin && !isDestination) continue;

            // Simular swap simplificado
            const tA = window.getTurnoOperativoBase(requestedA, date, { eventos });
            const tB = window.getTurnoOperativoBase(requestedB, date, { eventos });
            result.turno = isOrigin ? tB : tA;
            result.cambio = true;
            if (resolvedA !== requestedA || resolvedB !== requestedB) {
                console.log('LOG: CHANGE_TARGET_RESOLVED for', empId);
            }
        }
    }
    return result;
};

// --- DATA: Sercotel Guadiana Case ---
const events = [
    { id: 'EV_VAC', tipo: 'VAC', fecha_inicio: '2026-06-01', fecha_fin: '2026-06-07', empleado_id: 'Dani', empleado_destino_id: 'sin asignar' },
    { id: 'EV_SWAP', tipo: 'INTERCAMBIO_TURNO', fecha_inicio: '2026-06-02', fecha_fin: '2026-06-02', empleado_id: 'Diana', empleado_destino_id: 'Dani' }
];

const date = '2026-06-02';

// Simulation 1: No pre-built maps
console.log('--- TEST 1: Dynamic Resolution ---');
console.log('Diana:', window.resolveEmployeeDay({ empleadoId: 'Diana', fecha: date, eventos: events }));
console.log('Dani:', window.resolveEmployeeDay({ empleadoId: 'Dani', fecha: date, eventos: events }));
console.log('sin asignar:', window.resolveEmployeeDay({ empleadoId: 'sin asignar', fecha: date, eventos: events }));

// Simulation 2: With pre-built maps (as per admin.js change)
console.log('\n--- TEST 2: Map-based Resolution ---');
const opMap = new Map();
const dMap = new Map();
dMap.set('dani', 'sin asignar');
opMap.set(date, dMap);
const baseIndex = { operationalOccupantByOriginalEmployeeId: opMap };

console.log('Diana:', window.resolveEmployeeDay({ empleadoId: 'Diana', fecha: date, eventos: events, baseIndex }));
console.log('Dani:', window.resolveEmployeeDay({ empleadoId: 'Dani', fecha: date, eventos: events, baseIndex }));
console.log('sin asignar:', window.resolveEmployeeDay({ empleadoId: 'sin asignar', fecha: date, eventos: events, baseIndex }));
