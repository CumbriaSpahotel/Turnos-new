/* shift-resolver.js
 * MOTOR ÚNICO DE RESOLUCIÓN DE TURNOS
 * v5.0 - Estabilización Estructural
 */

console.log("[ShiftResolver] Iniciando carga v5.0...");

(function () {
    const _cache = new Map();

    // --- 1. NORMALIZACIÓN CENTRALIZADA ---

    window.normalizeId = (value) => {
        if (!value) return '';
        return String(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
    };

    window.normalizeDate = (value) => {
        if (!value) return '';
        if (value instanceof Date) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return String(value).trim().split(/[T ]/)[0];
    };

    window.normalizeTipo = (value) => {
        const v = String(value || '')
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_');
        
        if (['VAC', 'VACACIONES', 'VACACION'].includes(v)) return 'VAC';
        if (['BAJA', 'BAJA_MEDICA', 'BM'].includes(v)) return 'BAJA';
        if (['PERM', 'PERMISO', 'PERM'].includes(v)) return 'PERMISO';
        
        if (v === 'CT' || v === 'CAMBIO_TURNO' || v === 'CAMBIO_DE_TURNO' || v === 'CAMBIO_DE_TURNOS') return 'CAMBIO_TURNO';
        if (v === 'INTERCAMBIO' || v === 'INTERCAMBIO_TURNO' || v === 'INTERCAMBIO_DE_TURNO' || v === 'INTERCAMBIO_DE_TURNOS') return 'INTERCAMBIO_TURNO';
        
        // Búsqueda por subcadena como fallback seguro
        if (v.includes('INTERCAMBIO')) return 'INTERCAMBIO_TURNO';
        if (v.includes('CAMBIO')) return 'CAMBIO_TURNO';
        if (v.includes('SUSTITU')) return 'SUSTITUCION';
        if (v.includes('COBERTU')) return 'COBERTURA';
        
        return v;
    };

    window.normalizeEstado = (value) => {
        const v = String(value || '').trim().toLowerCase();
        if (!v) return 'activo';
        if (['anulado', 'anulada', 'rechazado', 'rechazada', 'cancelado', 'cancelada'].includes(v)) return 'anulado';
        // Todo lo demás (incluyendo pendiente, aprobado, etc) se considera activo para operativa
        return 'activo';
    };

    window.eventoAplicaEnFecha = (evento, fecha) => {
        const f = window.normalizeDate(fecha);
        const fi = window.normalizeDate(evento.fecha_inicio || evento.desde || evento.fecha);
        const ff = window.normalizeDate(evento.fecha_fin || evento.hasta || evento.fecha_inicio || evento.fecha);
        if (!fi) return false;
        return f >= fi && f <= ff;
    };

    window.eventoPerteneceAEmpleado = (evento, empleadoId) => {
        const target = window.normalizeId(empleadoId);
        if (!target) return false;

        const candidatos = [
            evento.empleado_id,
            evento.empleado_a_id,
            evento.origen_id,
            evento.empleado,
            evento.empleado_nombre,
            evento.nombre,
            evento.titular,
            evento.titular_id,
            evento.id_empleado,
            evento.participante_a,
            evento.empleado_destino_id,
            evento.empleado_b_id,
            evento.destino_id,
            evento.sustituto_id,
            evento.empleado_destino,
            evento.empleado_destino_nombre,
            evento.sustituto,
            evento.participante_b,
            evento.payload?.empleado_id,
            evento.payload?.empleado_destino_id,
            evento.payload?.sustituto_id,
            evento.payload?.sustituto
        ].filter(Boolean).map(window.normalizeId);

        return candidatos.includes(target);
    };

    window.getOtroEmpleadoDelCambio = (evento, empleadoId) => {
        const target = window.normalizeId(empleadoId);
        const a = window.normalizeId(evento.empleado_id || evento.empleado_a_id || evento.origen_id || evento.empleado || evento.participante_a || evento.titular_id);
        const b = window.normalizeId(evento.empleado_destino_id || evento.empleado_b_id || evento.destino_id || evento.sustituto_id || evento.empleado_destino || evento.participante_b || evento.sustituto);

        if (target === a) return b;
        if (target === b) return a;
        return '';
    };

    window.getTurnoBaseDeEmpleado = (empleadoId, fecha, baseIndex) => {
        if (!baseIndex || !baseIndex.porEmpleadoFecha) return null;
        const normId = window.normalizeId(empleadoId);
        const date = window.normalizeDate(fecha);
        
        const tryGet = (id) => {
            const k = `${id}_${date}`;
            if (baseIndex.porEmpleadoFecha.has(k)) {
                const val = baseIndex.porEmpleadoFecha.get(k);
                // Si la celda existe pero está vacía, se asume Descanso (D) por convención de Excel
                if (val === null || val === undefined || String(val).trim() === '') return 'D';
                const v = String(val).trim().toUpperCase();
                if (v === 'D' || v === 'DESCANSO') return 'D';
                return val;
            }
            return null; // No hay asignación real en el índice para este día
        };

        // 1. Por ID directo
        let res = tryGet(normId);
        if (res !== null) return res;
        
        // 2. Por alias
        const alias = baseIndex.aliasesEmpleado?.get(normId);
        if (alias) {
            res = tryGet(alias);
            if (res !== null) return res;
        }
        
        // 3. Inversa
        for (const [name, canonical] of (baseIndex.aliasesEmpleado || [])) {
            if (canonical === normId) {
                res = tryGet(name);
                if (res !== null) return res;
            }
        }

        return null;
    };

    // --- 2. MOTOR DE PRIORIDAD ---

    const PRIORITY_RANK = {
        'BAJA': 1,
        'VAC': 2,
        'VACACIONES': 2,
        'PERMISO': 3,
        'INTERCAMBIO_TURNO': 4,
        'CT': 4,
        'CAMBIO_TURNO': 5,
        'COBERTURA': 6,
        'SUSTITUCION': 6,
        'BASE': 7,
        'SIN_TURNO': 8
    };

    // --- 3. RESOLVE EMPLOYEE DAY ---

    window.resolveEmployeeDay = ({
        empleado,
        empleadoId,
        hotel,
        fecha,
        turnoBase,
        eventos = [],
        baseIndex = null
    }) => {
        const empId = window.normalizeId(empleadoId || empleado?.id || empleado?.nombre);
        const date = window.normalizeDate(fecha);
        const normHotel = hotel ? window.normalizeId(hotel) : null;

        let effectiveBase = turnoBase;
        if (effectiveBase === undefined || effectiveBase === null) {
            effectiveBase = window.getTurnoBaseDeEmpleado ? window.getTurnoBaseDeEmpleado(empId, date, baseIndex) : null;
        }

        const result = {
            empleadoId: empId,
            empleadoNombre: empleado?.nombre || empleadoId || 'Desconocido',
            fecha: date,
            hotel: normHotel,
            turno: effectiveBase || null,
            turnoBase: effectiveBase || null,
            origen: effectiveBase ? 'BASE' : 'SIN_TURNO',
            incidencia: null,
            cambio: false,
            intercambio: false,
            sustituyeA: null,
            sustituidoPor: null,
            evento: null,
            errores: []
        };

        if (!empId || !date) {
            result.errores.push('ID o fecha no definidos');
            return result;
        }

        // 0. Normalizar turno base: 'D' es un turno válido (Descanso). 
        // Si no hay turnoBase, el valor por defecto es '—' (Sin Programación).
        const tbUpper = String(result.turno || '').toUpperCase();
        if (tbUpper === 'D' || tbUpper === 'DESCANSO') {
            result.turno = 'D';
            result.turnoBase = 'D';
        } else if (!result.turno) {
            result.turno = '—';
            result.turnoBase = null;
            result.origen = 'SIN_TURNO';
        }

        // 1. Buscar eventos aplicables
        const eventosActivos = eventos.filter(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return false;
            return window.eventoAplicaEnFecha(ev, date) && window.eventoPerteneceAEmpleado(ev, empId);
        });

        if (eventosActivos.length > 0) {
            // Ordenar por prioridad
            eventosActivos.sort((a, b) => {
                const pA = PRIORITY_RANK[window.normalizeTipo(a.tipo)] || 99;
                const pB = PRIORITY_RANK[window.normalizeTipo(b.tipo)] || 99;
                return pA - pB;
            });

            const ev = eventosActivos[0];
            const tipo = window.normalizeTipo(ev.tipo);
            result.evento = ev;
            result.origen = tipo;

            if (['BAJA', 'VAC', 'PERMISO'].includes(tipo)) {
                result.incidencia = tipo;
                result.turno = null;
                result.cambio = true;
                
                // Relación de sustitución
                const otroId = window.getOtroEmpleadoDelCambio(ev, empId);
                if (otroId) {
                    result.sustituidoPor = otroId;
                }
            } else if (tipo === 'INTERCAMBIO_TURNO') {
                result.cambio = true;
                result.intercambio = true;
                
                const otroId = window.getOtroEmpleadoDelCambio(ev, empId);
                if (otroId) {
                    const otroTurnoBase = window.getTurnoBaseDeEmpleado(otroId, date, baseIndex);
                    // Regla: el intercambio recibe lo que el otro tenía, incluyendo D
                    result.turno = otroTurnoBase || 'D';
                } else {
                    result.turno = ev.turno_nuevo || result.turno;
                }
            } else if (tipo === 'CAMBIO_TURNO') {
                result.cambio = true;
                result.turno = ev.turno_nuevo || ev.turno_original || result.turno;
            } else if (tipo === 'COBERTURA' || tipo === 'SUSTITUCION') {
                const titularId = window.normalizeId(ev.empleado_id || ev.titular_id || ev.titular || ev.participante_a);
                if (empId !== titularId) {
                    // Soy el sustituto
                    result.sustituyeA = titularId;
                    const titularTurnoBase = window.getTurnoBaseDeEmpleado(titularId, date, baseIndex);
                    result.turno = titularTurnoBase || 'D';
                    result.cambio = true;
                } else {
                    // Soy el titular
                    result.sustituidoPor = window.getOtroEmpleadoDelCambio(ev, empId);
                }
            }
        }

        // El motor ahora mantiene 'D' como valor explícito para evitar confusiones con vacíos
        
        // Mapeo de propiedades para compatibilidad con UI y TurnosRules
        result.turnoFinal = result.turno;
        result.isModified = result.cambio;
        result.isAbsence = !!result.incidencia;
        result.estadoFinal = result.incidencia || (result.turno === 'D' ? 'DESCANSO' : 'NORMAL');
        result.sourceReason = result.incidencia ? `EVENTO_${result.origen}` : (result.turnoBase ? 'BASE_PLANNING' : 'SIN_TURNO');
        result.coversEmployeeId = result.sustituyeA;
        result.coveredByEmployeeId = result.sustituidoPor;
        
        // Propiedades de compatibilidad legacy para validación
        result.rol = result.sustituyeA ? 'sustituto' : 'titular';
        result.cubierto_por = result.sustituidoPor;

        if (window.DEBUG_MODE === true && result.empleadoNombre.includes('Federico')) {
            console.log('[BASE LOOKUP DEBUG]', {
                empleado: result.empleadoNombre,
                fecha: result.fecha,
                turnoBase: result.turnoBase,
                turnoFinal: result.turno,
                origen: result.origen
            });
        }

        return result;
    };

    // --- 4. ÍNDICES CENTRALES ---

    window.buildIndices = (employees = [], events = [], baseRows = []) => {
        const baseIndex = {
            porEmpleadoFecha: new Map(),
            porHotelFecha: new Map(),
            aliasesEmpleado: new Map()
        };

        const eventIndex = {
            porEmpleadoFecha: new Map(),
            porFecha: new Map(),
            porHotelFecha: new Map()
        };

        // Aliases: nombre -> id y viceversa
        employees.forEach(emp => {
            const id = window.normalizeId(emp.id);
            const nombre = window.normalizeId(emp.nombre);
            if (id && nombre) {
                baseIndex.aliasesEmpleado.set(nombre, id);
            }
        });

        // Base Index: porEmpleadoFecha
        baseRows.forEach(row => {
            const empId = window.normalizeId(row.empleadoId || row.empleado_id);
            const date = window.normalizeDate(row.fecha);
            if (empId && date) {
                const key = `${empId}_${date}`;
                baseIndex.porEmpleadoFecha.set(key, row.turno);
            }
        });

        // Event Index: porFecha
        events.forEach(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            const date = window.normalizeDate(ev.fecha_inicio || ev.fecha);
            if (!eventIndex.porFecha.has(date)) eventIndex.porFecha.set(date, []);
            eventIndex.porFecha.get(date).push(ev);
        });

        return { baseIndex, eventIndex };
    };

    // --- 5. LOGGING ESTRUCTURADO ---

    const originalError = console.error;
    console.error = function(...args) {
        if (args[0] === 'ERROR:' && typeof args[1] === 'object' && args[1] !== null) {
            const obj = args[1];
            originalError.apply(console, ['[VALIDACION ERROR]', {
                tipo: obj.tipo || 'ENGINE',
                mensaje: obj.mensaje || 'Error estructural detectado',
                fecha: obj.fecha || 'N/A',
                empleado: obj.empleado_id || obj.empleado || 'N/A',
                incidencia: obj.incidencia || null,
                turnoFinal: obj.turnoFinal || obj.turno || null,
                raw: obj
            }]);
            return;
        }
        
        // Bloquear spam masivo si no hay DEBUG_MODE
        if (!window.DEBUG_MODE) {
            const msg = String(args[0]);
            if (msg.includes('RESOLVER FINAL') || msg.includes('EVENTOS SAMPLE') || msg.includes('DIAGNOSTICO')) {
                return;
            }
        }
        
        originalError.apply(console, args);
    };

    // --- 6. TESTS DE REGRESIÓN ---

    window.runTurnosRegressionTests = async () => {
        console.group("%c[TEST] Ejecutando Regression Tests Turnos v5.0", "color: #3b82f6; font-weight: bold;");
        const results = [];
        
        const baseIndex = {
            porEmpleadoFecha: new Map([
                ['cristina_2026-04-20', 'M'],
                ['cristina_2026-04-21', 'M'],
                ['dani_2026-04-25', 'T'],
                ['macarena_2026-04-25', 'M'],
                ['miriam_2026-04-20', 'D']
            ]),
            aliasesEmpleado: new Map([
                ['cristina', 'id_cristina'],
                ['dani', 'id_dani'],
                ['macarena', 'id_macarena'],
                ['miriam', 'id_miriam']
            ])
        };

        // A) Cristina VAC
        const evVac = { tipo: 'VAC', fecha_inicio: '2026-04-20', fecha_fin: '2026-04-26', empleado_id: 'cristina' };
        const resA = window.resolveEmployeeDay({ empleadoId: 'cristina', fecha: '2026-04-20', turnoBase: 'M', eventos: [evVac], baseIndex });
        const testA = resA.incidencia === 'VAC' && resA.turno === null;
        results.push({ name: 'Cristina VAC', ok: testA, got: resA });

        // B) Miriam sustituyendo a Cristina
        const evSust = { tipo: 'SUSTITUCION', fecha_inicio: '2026-04-20', fecha_fin: '2026-04-20', empleado_id: 'cristina', empleado_destino_id: 'miriam' };
        const resB = window.resolveEmployeeDay({ empleadoId: 'miriam', fecha: '2026-04-20', turnoBase: 'D', eventos: [evVac, evSust], baseIndex });
        const testB = resB.sustituyeA === 'cristina' && resB.turno === 'M';
        results.push({ name: 'Miriam Sustituye', ok: testB, got: resB });

        // C) Dani <-> Macarena
        const evInter = { tipo: 'INTERCAMBIO_TURNO', fecha_inicio: '2026-04-25', fecha_fin: '2026-04-25', empleado_id: 'dani', empleado_destino_id: 'macarena' };
        const resC1 = window.resolveEmployeeDay({ empleadoId: 'dani', fecha: '2026-04-25', turnoBase: 'T', eventos: [evInter], baseIndex });
        const resC2 = window.resolveEmployeeDay({ empleadoId: 'macarena', fecha: '2026-04-25', turnoBase: 'M', eventos: [evInter], baseIndex });
        const testC = resC1.turno === 'M' && resC2.turno === 'T' && resC1.intercambio && resC2.intercambio;
        results.push({ name: 'Dani <-> Macarena', ok: testC, got: { resC1, resC2 } });

        results.forEach(r => {
            console.log(`${r.ok ? '✅' : '❌'} ${r.name}`, r.ok ? '' : r.got);
        });
        
        console.groupEnd();
        return results;
    };

    window.ShiftResolver = {
        resolveEmployeeDay: window.resolveEmployeeDay,
        buildIndices: window.buildIndices,
        clearCache: () => _cache.clear(),
        runTests: window.runTurnosRegressionTests
    };

    window.resolverTurnoFinal = window.resolveEmployeeDay; // Alias para compatibilidad inmediata

    console.log("[ShiftResolver] Carga finalizada v5.0.");
})();
