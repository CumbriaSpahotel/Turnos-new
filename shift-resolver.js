/* shift-resolver.js
 * MOTOR PURO DE RESOLUCIÓN DE TURNOS
 * v4.1 - Robusto y Depurado
 */

console.log("[ShiftResolver] Iniciando carga v4.1...");

(function () {
    // Definimos el objeto en el scope global inmediatamente
    window.ShiftResolver = {
        resolveDay: null
    };

    const normalizeString = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const isAbsenceType = (tipo) => {
        const t = String(tipo || '').toUpperCase();
        return t.startsWith('VAC') || t.startsWith('BAJA') || t.startsWith('PERM');
    };

    const resolveDay = ({ date, employees = [], baseRows = [], events = [], manualOverrides = [] }) => {
        console.log("[ShiftResolver] Ejecutando resolveDay para:", date);
        const profilesByNorm = new Map();
        employees.forEach(p => {
            if (p.id) profilesByNorm.set(normalizeString(p.id), p);
            if (p.nombre) profilesByNorm.set(normalizeString(p.nombre), p);
        });

        const canonicalize = (name) => {
            const n = normalizeString(name);
            const profile = profilesByNorm.get(n);
            return profile ? normalizeString(profile.id || profile.nombre || name) : n;
        };

        const stateMap = new Map();

        const getOrCreateState = (empId, baseRow = null) => {
            const norm = canonicalize(empId);
            if (!norm) return null;
            if (!stateMap.has(norm)) {
                const turnoBase = baseRow ? baseRow.turno : null;
                const isDescanso = !turnoBase || String(turnoBase).toUpperCase() === 'D';
                stateMap.set(norm, {
                    employeeId: baseRow ? (baseRow.empleadoId || baseRow.empleado_id) : empId,
                    date: date,
                    hotelFinal: baseRow ? (baseRow.hotel || baseRow.hotel_id) : null,
                    turnoFinal: isDescanso ? null : turnoBase,
                    estadoFinal: isDescanso ? "DESCANSO" : "TRABAJANDO",
                    isModified: false,
                    isAbsence: false,
                    coversEmployeeId: null,
                    coveredByEmployeeId: null,
                    sourceReason: "BASE",
                    baseTurno: turnoBase,
                    baseHotel: baseRow ? (baseRow.hotel || baseRow.hotel_id) : null,
                    appliedEventId: null
                });
            }
            return stateMap.get(norm);
        };

        // 0. Base
        baseRows.forEach(row => getOrCreateState(row.empleadoId, row));

        const validEvents = events.filter(e => e.estado !== 'anulado');
        const eventPriority = {
            'REFUERZO': 10, 'CAMBIO_TURNO': 20, 'INTERCAMBIO_TURNO': 20,
            'CAMBIO_HOTEL': 20, 'CAMBIO_POSICION': 20, 'INTERCAMBIO_HOTEL': 20, 'INTERCAMBIO_POSICION': 20,
            'COBERTURA': 30, 'VAC': 40, 'BAJA': 50, 'PERM': 50, 'BAJA_EMPRESA': 50
        };

        const sortedEvents = [...validEvents].sort((a, b) => {
            const typeA = String(a.tipo || '').toUpperCase().split(' ')[0];
            const typeB = String(b.tipo || '').toUpperCase().split(' ')[0];
            return (eventPriority[typeA] || 0) - (eventPriority[typeB] || 0);
        });

        // Aplicar eventos
        sortedEvents.forEach(evt => {
            const type = String(evt.tipo || '').toUpperCase().split(' ')[0];
            const emp = evt.empleado_id;
            const dest = evt.empleado_destino_id;

            if (type === 'REFUERZO') {
                const state = getOrCreateState(emp);
                if (state && !state.isAbsence) {
                    state.turnoFinal = evt.turno_nuevo || evt.turno_original || state.turnoFinal;
                    state.hotelFinal = evt.hotel_destino || evt.hotel_origen || state.hotelFinal;
                    state.estadoFinal = 'TRABAJANDO';
                    state.isModified = true;
                    state.sourceReason = type;
                }
            } 
            else if (type === 'CAMBIO_TURNO' || type === 'CAMBIO_HOTEL') {
                const state = getOrCreateState(emp);
                if (state && !state.isAbsence) {
                    if (evt.turno_nuevo) state.turnoFinal = evt.turno_nuevo;
                    if (evt.hotel_destino) state.hotelFinal = evt.hotel_destino;
                    state.estadoFinal = 'TRABAJANDO';
                    state.isModified = true;
                    state.sourceReason = type;
                }
            }
            else if (type.includes('INTERCAMBIO')) {
                if (emp && dest) {
                    const sA = getOrCreateState(emp);
                    const sB = getOrCreateState(dest);
                    if (sA && sB) {
                        if (type.includes('HOTEL')) {
                            const tmp = sA.hotelFinal; sA.hotelFinal = sB.hotelFinal; sB.hotelFinal = tmp;
                        } else {
                            const tmp = sA.turnoFinal; sA.turnoFinal = sB.turnoFinal; sB.turnoFinal = tmp;
                            sA.estadoFinal = sA.turnoFinal ? 'TRABAJANDO' : 'DESCANSO';
                            sB.estadoFinal = sB.turnoFinal ? 'TRABAJANDO' : 'DESCANSO';
                        }
                        sA.isModified = true; sB.isModified = true;
                        sA.sourceReason = type; sB.sourceReason = type;
                    }
                }
            }
            else if (type === 'COBERTURA' || ['VAC', 'BAJA', 'PERM'].includes(type)) {
                const isAbs = ['VAC', 'BAJA', 'PERM'].includes(type);
                const sEmp = getOrCreateState(emp);
                if (sEmp) {
                    if (isAbs) {
                        sEmp.estadoFinal = type === 'VAC' ? 'VACACIONES' : type;
                        sEmp.isAbsence = true; sEmp.turnoFinal = null;
                        sEmp.sourceReason = type;
                    }
                    if (dest) {
                        const sDest = getOrCreateState(dest);
                        if (sDest && !sDest.isAbsence) {
                            sDest.turnoFinal = sEmp.baseTurno;
                            sDest.hotelFinal = sEmp.baseHotel;
                            sDest.estadoFinal = 'TRABAJANDO';
                            sDest.isModified = true;
                            sDest.coversEmployeeId = sEmp.employeeId;
                            sDest.sourceReason = `SUSTITUCION_${type}`;
                            sEmp.coveredByEmployeeId = sDest.employeeId;
                        }
                    }
                }
            }
        });

        // Manual
        manualOverrides.forEach(ov => {
            const tipo = String(ov.tipo || '').toUpperCase().split(' ')[0];
            const emp = ov.empleado_id;
            const sEmp = getOrCreateState(emp);
            if (!sEmp || sEmp.isAbsence) return;

            if (tipo === 'CT' || tipo === 'CAMBIO_TURNO') {
                sEmp.turnoFinal = (ov.turno && ov.turno !== 'CT') ? ov.turno : sEmp.turnoFinal;
                sEmp.estadoFinal = sEmp.turnoFinal ? 'TRABAJANDO' : 'DESCANSO';
                sEmp.isModified = true;
                sEmp.sourceReason = "OVERRIDE_MANUAL";
            } else if (tipo === 'NORMAL' && ov.turno) {
                sEmp.turnoFinal = ov.turno === 'D' ? null : ov.turno;
                sEmp.estadoFinal = ov.turno === 'D' ? 'DESCANSO' : 'TRABAJANDO';
                sEmp.isModified = true;
                sEmp.sourceReason = "OVERRIDE_MANUAL";
            }
            if (ov.hotel_id) sEmp.hotelFinal = ov.hotel_id;
        });

        stateMap.forEach(s => {
            if (s.turnoFinal === '') s.turnoFinal = null;
            if (!s.turnoFinal && s.estadoFinal === "TRABAJANDO") s.estadoFinal = "DESCANSO";
        });

        return stateMap;
    };

    // Asignamos la función al objeto ya expuesto en window
    window.ShiftResolver.resolveDay = resolveDay;
    console.log("[ShiftResolver] Carga finalizada v4.1.");
})();
