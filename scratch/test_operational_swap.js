
// Mocking necessary global functions
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
window.eventoPerteneceAHotel = (ev, hotel) => true; // Simplificado
window.eventoPerteneceAEmpleado = (ev, empId) => {
    const normId = window.normalizeId(empId);
    const tId = window.normalizeId(ev.empleado_id || ev.titular_id || ev.participante_a);
    const sId = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id || ev.participante_b);
    return tId === normId || sId === normId;
};
window.isTitularOfAbsence = (ev, empId) => {
    return window.normalizeId(ev.empleado_id || ev.titular_id || ev.participante_a) === window.normalizeId(empId);
};
window.getOtroEmpleadoDelCambio = (ev, empId) => {
    const normId = window.normalizeId(empId);
    const a = window.normalizeId(ev.empleado_id || ev.titular_id || ev.participante_a);
    const b = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id || ev.participante_b);
    return a === normId ? b : a;
};
window.getTurnoBaseDeEmpleado = (empId, date, index) => {
    const norm = window.normalizeId(empId);
    if (norm === 'diana') return 'M';
    if (norm === 'dani') return 'T';
    if (norm === 'sin asignar') return '—';
    return 'D';
};
window.getTurnoOperativoBase = (empId, date, context) => {
    const normId = window.normalizeId(empId);
    const events = context.eventos || [];
    // Simplificado: ver si alguien lo cubre
    const subEvent = events.find(ev => 
        window.eventoAplicaEnFecha(ev, date) &&
        window.normalizeId(ev.empleado_destino_id || ev.sustituto_id) === normId &&
        ['VAC', 'BAJA', 'SUSTITUCION'].includes(window.normalizeTipo(ev.tipo))
    );
    if (subEvent) {
        const titularId = window.normalizeId(subEvent.empleado_id || subEvent.titular_id);
        return window.getTurnoBaseDeEmpleado(titularId, date, context.baseIndex);
    }
    return window.getTurnoBaseDeEmpleado(empId, date, context.baseIndex);
};

window.isValidShiftValue = (v) => ['M','T','N','D'].includes(v);
window.isInvalidLegacyChangeValue = (v) => v === 'CT';
window.normalizeShiftValue = (v) => v;

const PRIORITY_RANK = {
    'BAJA': 1, 'VAC': 2, 'PERMISO': 3, 'INTERCAMBIO_TURNO': 6, 'CAMBIO_TURNO': 6, 'BASE': 7
};

// NEW HELPER
window.getOperationalOccupant = (empId, date, events) => {
    const normId = window.normalizeId(empId);
    const ev = events.find(e => 
        window.normalizeEstado(e.estado) !== 'anulado' &&
        window.eventoAplicaEnFecha(e, date) &&
        window.isTitularOfAbsence(e, normId) &&
        ['VAC', 'BAJA', 'PERMISO', 'SUSTITUCION', 'COBERTURA'].includes(window.normalizeTipo(e.tipo)) &&
        (e.empleado_destino_id || e.sustituto_id || e.sustituto)
    );
    if (ev) {
        const sustId = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id || ev.sustituto);
        if (sustId && sustId !== normId) {
            return window.getOperationalOccupant(sustId, date, events);
        }
    }
    return normId;
};

// MODIFIED resolveEmployeeDay
window.resolveEmployeeDay = ({ empleadoId, fecha, eventos = [] }) => {
    const empId = window.normalizeId(empleadoId);
    const date = window.normalizeDate(fecha);
    const turnoBase = window.getTurnoBaseDeEmpleado(empId, date);

    const result = {
        empleadoId: empId,
        fecha: date,
        turno: turnoBase || '—',
        turnoBase: turnoBase || null,
        incidencia: null,
        cambio: false,
        intercambio: false,
        sustituyeA: null,
        sustitutoDe: null
    };

    let eventosActivos = eventos.filter(ev => 
        window.eventoAplicaEnFecha(ev, date) &&
        window.eventoPerteneceAEmpleado(ev, empId)
    );

    // Prioridad
    eventosActivos.sort((a, b) => (PRIORITY_RANK[window.normalizeTipo(a.tipo)] || 99) - (PRIORITY_RANK[window.normalizeTipo(b.tipo)] || 99));

    for (const ev of eventosActivos) {
        const tipo = window.normalizeTipo(ev.tipo);
        
        // Soy titular de ausencia?
        if (['VAC', 'BAJA'].includes(tipo) && window.isTitularOfAbsence(ev, empId)) {
            result.incidencia = tipo;
            result.turno = null;
            break; // Terminal
        }

        // Soy sustituto?
        if (['VAC', 'BAJA', 'SUSTITUCION'].includes(tipo) && !window.isTitularOfAbsence(ev, empId)) {
            const titularId = window.normalizeId(ev.empleado_id || ev.titular_id);
            result.sustituyeA = titularId;
            result.turno = window.getTurnoBaseDeEmpleado(titularId, date);
            continue; // Seguir por si hay cambios
        }

        // Cambio / Intercambio
        if (tipo === 'INTERCAMBIO_TURNO' || tipo === 'CAMBIO_TURNO') {
            const requestedA = window.normalizeId(ev.empleado_id || ev.titular_id);
            const requestedB = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id);
            

            // RESOLUCIÓN OPERATIVA
            const resolvedA = window.getOperationalOccupant(requestedA, date, eventos);
            const resolvedB = window.getOperationalOccupant(requestedB, date, eventos);
            
            const isOrigin = empId === resolvedA;
            const isDestination = empId === resolvedB;

            if (isOrigin || isDestination) {
                console.log(`[DEBUG] empId=${empId} matching event ${ev.id}: requested=${requestedA}<->${requestedB} resolved=${resolvedA}<->${resolvedB} isOrigin=${isOrigin} isDest=${isDestination}`);
                if (resolvedA !== requestedA || resolvedB !== requestedB) {
                    console.log(`[LOG] CHANGE_TARGET_RESOLVED: ${isOrigin ? (requestedA !== resolvedA ? requestedA : '?') : (requestedB !== resolvedB ? requestedB : '?')} -> ${empId}`);
                }
            }

            if (!isOrigin && !isDestination) continue;

            // Simular swap
            const tA = window.getTurnoOperativoBase(requestedA, date, { eventos });
            const tB = window.getTurnoOperativoBase(requestedB, date, { eventos });
            
            result.turno = isOrigin ? tB : tA;
            result.cambio = true;
            result.intercambio = true;
        }
    }

    return result;
};

// --- DATA ---
const events = [
    {
        id: 'EV_VAC_DANI',
        tipo: 'VAC',
        fecha_inicio: '2026-06-01',
        fecha_fin: '2026-06-07',
        empleado_id: 'Dani',
        empleado_destino_id: 'sin asignar',
        estado: 'activo'
    },
    {
        id: 'EV_SWAP_DIANA_DANI',
        tipo: 'INTERCAMBIO_TURNO',
        fecha_inicio: '2026-06-02',
        fecha_fin: '2026-06-02',
        empleado_id: 'Diana',
        empleado_destino_id: 'Dani',
        estado: 'activo'
    }
];

const date = '2026-06-02';

console.log('--- TEST: 2026-06-02 ---');

const resDiana = window.resolveEmployeeDay({ empleadoId: 'Diana', fecha: date, eventos: events });
console.log('Diana:', resDiana);

const resDani = window.resolveEmployeeDay({ empleadoId: 'Dani', fecha: date, eventos: events });
console.log('Dani:', resDani);

const resSinAsignar = window.resolveEmployeeDay({ empleadoId: 'sin asignar', fecha: date, eventos: events });
console.log('sin asignar:', resSinAsignar);
