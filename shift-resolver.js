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

    /**
     * Detecta si un empleado es ocasional, de apoyo, refuerzo, etc.
     * Basado en múltiples campos de texto y tags.
     */
    window.isEmpleadoOcasionalOApoyo = (emp) => {
        if (!emp) return false;
        
        // Flags explícitos y booleanos
        if (emp.excludeCounters || 
            emp.tipo_trabajador === 'apoyo' || 
            emp.es_apoyo === true || 
            emp.apoyo === true || 
            emp.occasional === true || 
            emp.eventual === true) return true;

        const text = [
            emp.tipo,
            emp.puesto,
            emp.categoria,
            emp.rol,
            emp.notas,
            Array.isArray(emp.tags) ? emp.tags.join(' ') : emp.tags,
            emp.tipo_personal
        ].filter(Boolean).join(' ');

        const normalizedText = window.normalizeId(text);
        
        // El regex busca palabras clave normalizadas (normalizeId quita tildes)
        // SUSTITUTO NO debe ser motivo de ocultación aquí si es sustituto operativo
        return /apoyo|ocasional|eventual|refuerzo|extra|personal de apoyo|trabajador ocasional/.test(normalizedText);
    };

    /**
     * TAREA CODEX: Determina si se deben mostrar los chips de recuentos (noches/descansos).
     * Regla: Se ocultan para personal de apoyo/ocasional PURO.
     * Se MUESTRAN para personal de plantilla O sustitutos operativos (coberturas).
     */
    window.shouldShowEmployeeCounters = (emp, row) => {
        if (!emp) return true;
        
        // 1. Detección de Apoyo/Ocasional estructural
        const isSupport = window.isEmpleadoOcasionalOApoyo?.(emp) || (row && row.excludeCounters === true);
        
        // 2. Detección de Cobertura Operativa (Miriam cubriendo a alguien)
        // Se considera cobertura operativa si el row o algún día tiene metadatos de sustitución
        const hasOperationalData = (row) => {
            if (!row) return false;
            // Verificación en la raíz de la fila
            if (row.esCoberturaAusencia || row.titular_cubierto || row.sustituyeA || row.origen === 'sustitucion') return true;
            // Verificación en los días (formato snapshot)
            if (row.dias) {
                return Object.values(row.dias).some(d => d.titular_cubierto || d.origen === 'sustitucion' || d.origen === 'vacaciones');
            }
            // Verificación en cells (formato renderRow admin)
            if (row.cells) {
                return row.cells.some(c => c.titular || c.sustituyeA || c.tipo === 'VAC' || c.origen === 'sustitucion');
            }
            return false;
        };

        const isOperationalCover = hasOperationalData(row);

        // REGLA FINAL:
        // Si es una cobertura operativa principal (Miriam cubriendo vacaciones), SIEMPRE mostrar chips
        if (isOperationalCover) return true;
        
        // Si es personal de apoyo puro (y no es cobertura operativa), OCULTAR chips
        if (isSupport) return false;
        
        // Por defecto (plantilla regular), MOSTRAR chips
        return true;
    };

    window.normalizeDate = (value) => {
        if (!value) return '';
        if (value instanceof Date) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        const s = String(value).trim();
        // ISO con hora: '2026-04-20T...' -> '2026-04-20'
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        // Formato dd/mm/yyyy o dd/mm/yy (ej. '20/04/2026', '20/04/26')
        const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
        if (dmyMatch) {
            const day   = dmyMatch[1].padStart(2, '0');
            const month = dmyMatch[2].padStart(2, '0');
            let   year  = dmyMatch[3];
            if (year.length === 2) year = (Number(year) > 50 ? '19' : '20') + year;
            return `${year}-${month}-${day}`;
        }
        // Formato dd/mes/yy con mes abreviado en español (ej. '20/abr/26')
        const MESES = { ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12 };
        const mesMatch = s.match(/^(\d{1,2})[/\-](\w{3})[/\-](\d{2,4})$/i);
        if (mesMatch) {
            const day   = mesMatch[1].padStart(2, '0');
            const mKey  = mesMatch[2].toLowerCase().slice(0, 3);
            const mNum  = MESES[mKey];
            let   year  = mesMatch[3];
            if (year.length === 2) year = (Number(year) > 50 ? '19' : '20') + year;
            if (mNum) return `${year}-${String(mNum).padStart(2,'0')}-${day}`;
        }
        // Fallback: coger el primer bloque antes de T o espacio
        return s.split(/[T ]/)[0];
    };

    window.normalizeTipo = (value) => {
        // Eliminar emojis y caracteres no ASCII antes de normalizar
        const v = String(value || '')
            .replace(/[^\x00-\x7F]/g, '') // quitar emoji y non-ASCII
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+$/, ''); // quitar _ finales
        
        if (v.startsWith('VAC')) return 'VAC'; // VAC, VACACIONES, VAC_🏖️ quitado el emoji
        if (['BAJA', 'BAJA_MEDICA', 'BM'].includes(v)) return 'BAJA';
        if (v.startsWith('PERM')) return 'PERM'; // unify PERMISO → PERM
        
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

    window.getEventoHotel = (evento = {}) => {
        return evento.hotel || evento.hotel_id || evento.hotel_origen || evento.hotel_destino ||
            evento.payload?.hotel || evento.payload?.hotel_id || evento.payload?.hotel_origen || '';
    };

    window.eventoPerteneceAHotel = (evento, hotel) => {
        const eventHotel = window.normalizeId(window.getEventoHotel(evento));
        const rowHotel = window.normalizeId(hotel);
        const matches = !!eventHotel && !!rowHotel && eventHotel === rowHotel;
        if (!matches && window.DEBUG_MODE === true) {
            console.warn('[MATCH HOTEL DESCARTADO]', {
                eventoHotel: eventHotel || '(sin hotel)',
                filaHotel: rowHotel || '(sin hotel)',
                evento
            });
        }
        return matches;
    };

    window.eventoPerteneceAEmpleado = (evento, empleadoId, context = {}) => {
        const target = window.normalizeId(empleadoId);
        if (!target) return false;

        if (context.hotel && !window.eventoPerteneceAHotel(evento, context.hotel)) return false;

        const tipo = window.normalizeTipo(evento.tipo);

        // Para ausencias (VAC, BAJA, PERMISO): solo el TITULAR es el portador de la incidencia.
        // El sustituto (empleado_destino_id) NO hereda la ausencia — hereda el turno via lógica separada.
        const esAusencia = ['VAC', 'BAJA', 'PERMISO', 'PERM', 'FORMACION', 'FORM'].includes(tipo);

        // Campos del titular (siempre aplicables)
        const candidatosTitular = [
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
            evento.payload?.empleado_id
        ].filter(Boolean).map(window.normalizeId);

        // Campos del destino/sustituto — solo para CT/INTERCAMBIO/COBERTURA
        const candidatosDestino = esAusencia ? [] : [
            evento.empleado_destino_id,
            evento.empleado_b_id,
            evento.destino_id,
            evento.sustituto_id,
            evento.empleado_destino,
            evento.empleado_destino_nombre,
            evento.sustituto,
            evento.participante_b,
            evento.payload?.empleado_destino_id,
            evento.payload?.sustituto_id,
            evento.payload?.sustituto
        ].filter(Boolean).map(window.normalizeId);

        const candidatos = [...new Set([...candidatosTitular, ...candidatosDestino])];

        // Paso 1: match exacto (ruta normal)
        if (candidatos.includes(target)) return true;

        // Paso 2: fallback seguro por subcadena — solo si hay exactamente 1 candidato inequívoco
        // Cubre el caso: evento.empleado_id = "cristina garcia", target = "cristina" (o viceversa)
        if (target.length >= 3) {
            const coincidentes = [];
            if (window.DEBUG_MODE === true) {
                const parciales = candidatos.filter(c => c && c.length >= 3 && (c.includes(target) || target.includes(c)));
                if (parciales.length) {
                    console.warn('[MATCH EMPLEADO AMBIGUO]', {
                        empleadoFila: target,
                        candidatosEvento: candidatos,
                        parciales,
                        hotel: context.hotel || null,
                        razon: 'Sin match exacto; no se aplica fallback por substring entre empleados.'
                    });
                }
            }
            // Si hay múltiples coincidencias parciales, no resolver (ambiguo)
        }

        return false;
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
                // Si la celda existe pero está vacía, se asume Sin Turno (—)
                if (val === null || val === undefined || String(val).trim() === '') return '—';
                const v = String(val).trim().toUpperCase();
                if (v === 'D' || v === 'DESCANSO') return 'D';
                return val;
            }
            return null; // No hay asignación real en el índice para este día
        };

        // 0. REGLA OPERATIVA: ¿Es este empleado un sustituto activo para otro titular hoy?
        // Si lo es, su "turno base" para cualquier intercambio es el del titular al que cubre.
        if (baseIndex.ausenciaSustitucionMap) {
            let titularIdReal = null;
            baseIndex.ausenciaSustitucionMap.forEach((coberturas, normSust) => {
                if (titularIdReal) return;
                if (normSust === normId) {
                    const cob = coberturas.find(c => date >= c.fi && date <= c.ff);
                    if (cob) titularIdReal = cob.titularId;
                }
            });
            if (titularIdReal) {
                // Recursión simple para obtener el turno del titular (solo 1 nivel)
                const titularNorm = window.normalizeId(titularIdReal);
                const valTitular = tryGet(titularNorm);
                if (valTitular !== null) return valTitular;
            }
        }

        // 1. Por ID directo
        let res = tryGet(normId);
        if (res !== null) return res;
        
        // 2. Por alias registrado
        const alias = baseIndex.aliasesEmpleado?.get(normId);
        if (alias) {
            res = tryGet(alias);
            if (res !== null) return res;
        }
        
        // 3. Inversa de alias
        for (const [name, canonical] of (baseIndex.aliasesEmpleado || [])) {
            if (canonical === normId) {
                res = tryGet(name);
                if (res !== null) return res;
            }
        }

        // 4. Fallback por nombre aproximado (seguro: una parte contiene la otra, sin ambigüedad)
        // Solo se activa cuando no hay match exacto ni por alias.
        if (normId && normId.length >= 3) {
            // Extraer todas las claves del índice que correspondan a esta fecha
            const candidatos = [];
            for (const key of baseIndex.porEmpleadoFecha.keys()) {
                if (!key.endsWith(`_${date}`)) continue;
                const keyId = key.slice(0, key.length - date.length - 1);
                // Coincidencia segura: uno contiene al otro y no son demasiado cortos
                const coincide = (
                    (keyId.includes(normId) || normId.includes(keyId)) &&
                    keyId.length >= 3
                );
                if (coincide) candidatos.push(keyId);
            }

            if (candidatos.length === 1) {
                // Solo un candidato: resolución inequívoca
                if (window.DEBUG_MODE === true) {
                    console.warn('[BASE ALIAS AMBIGUO]', {
                        empleadoId: normId,
                        fecha: date,
                        candidatos,
                        razon: 'Sin match exacto; no se aplica fallback por substring entre empleados.'
                    });
                }
            } else if (candidatos.length > 1 && window.DEBUG_MODE === true) {
                console.warn('[BASE ALIAS AMBIGUO]', { empleadoId: normId, fecha: date, candidatos });
            }
        }

        return null;
    };

    window.getTurnoOperativoBase = (empleadoId, fecha, context = {}) => {
        const baseIndex = context.baseIndex || context;
        const turno = window.getTurnoBaseDeEmpleado(empleadoId, fecha, baseIndex);
        return turno === null || turno === undefined || String(turno).trim() === '' ? null : turno;
    };


    // --- 2. MOTOR DE PRIORIDAD ---

    const PRIORITY_RANK = {
        'BAJA': 1,
        'VAC': 2,
        'VACACIONES': 2,
        'PERMISO': 3,
        'PERM': 3,
        'FORMACION': 4,
        'FORM': 4,
        'SUSTITUCION': 5,
        'COBERTURA': 5,
        'INTERCAMBIO_TURNO': 6,
        'CT': 6,
        'CAMBIO_TURNO': 6,
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
            return window.eventoAplicaEnFecha(ev, date) &&
                window.eventoPerteneceAHotel(ev, hotel) &&
                window.eventoPerteneceAEmpleado(ev, empId, { hotel });
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

            if (['BAJA', 'VAC', 'PERMISO', 'PERM', 'FORMACION', 'FORM'].includes(tipo)) {
                result.incidencia = (tipo === 'PERM' ? 'PERMISO' : (tipo === 'FORM' ? 'FORMACION' : tipo));
                result.turno = null;
                result.cambio = true;
                
                // Relación de sustitución (para el titular)
                const otroId = window.getOtroEmpleadoDelCambio(ev, empId);
                if (otroId) result.sustituidoPor = otroId;
            } else if (tipo === 'COBERTURA' || tipo === 'SUSTITUCION') {
                const titularId = window.normalizeId(ev.empleado_id || ev.titular_id || ev.titular || ev.participante_a);
                if (empId !== titularId) {
                    // Soy el sustituto operativo de una ausencia
                    result.sustituyeA = titularId;
                    const titularTurnoBase = window.getTurnoBaseDeEmpleado(titularId, date, baseIndex);
                    // Regla: usa el turno de la posición cubierta, no el propio
                    result.turno = titularTurnoBase || '—';
                    result.cambio = true;
                    result.origen = 'SUSTITUCION';
                } else {
                    // Soy el titular (cubierto por otro)
                    result.sustituidoPor = window.getOtroEmpleadoDelCambio(ev, empId);
                }
            } else if (tipo === 'INTERCAMBIO_TURNO' || tipo === 'CAMBIO_TURNO') {
                result.cambio = true;
                result.intercambio = true;
                
                const otroId = window.getOtroEmpleadoDelCambio(ev, empId);
                if (otroId) {
                    const otroTurnoBase = window.getTurnoOperativoBase(otroId, date, { baseIndex });
                    result.turno = otroTurnoBase || '—';
                } else {
                    result.turno = ev.turno_nuevo || result.turno;
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

        // Debug VAC diagnóstico — solo si DEBUG_MODE=true
        if (window.DEBUG_MODE === true) {
            const vacCandidatos = (eventos || []).filter(ev => {
                const t = window.normalizeTipo(ev.tipo);
                return t === 'VAC' || t === 'BAJA' || t === 'PERMISO';
            });
            if (vacCandidatos.length > 0) {
                vacCandidatos.forEach(ev => {
                    const fi = window.normalizeDate(ev.fecha_inicio || ev.desde || ev.fecha);
                    const ff = window.normalizeDate(ev.fecha_fin || ev.hasta || ev.fecha_inicio || ev.fecha);
                    const aplicaFecha = date ? (date >= fi && date <= ff) : null;
                    const camposEmp = [
                        ev.empleado_id, ev.empleado_a_id, ev.empleado,
                        ev.empleado_nombre, ev.nombre, ev.titular
                    ].filter(Boolean).map(window.normalizeId);
                    const matchEmp = window.eventoPerteneceAEmpleado(ev, empId, { hotel });
                    console.log('[VAC MATCH INPUT]', {
                        tipoOriginal: ev.tipo,
                        tipoNormalizado: window.normalizeTipo(ev.tipo),
                        estadoOriginal: ev.estado,
                        estadoNormalizado: window.normalizeEstado(ev.estado),
                        fechaInicio: ev.fecha_inicio,
                        fechaInicioNorm: fi,
                        fechaFin: ev.fecha_fin,
                        fechaFinNorm: ff,
                        fechaConsulta: date,
                        aplicaFecha,
                        empleadoExcel: empId,
                        camposEmpleadoEvento: camposEmp,
                        matchEmpleado: matchEmp,
                        motivoNoMatch: !matchEmp ? 'eventoPerteneceAEmpleado=false' : !aplicaFecha ? 'eventoAplicaEnFecha=false' : 'OK'
                    });
                });
            }
        }

        if (window.DEBUG_MODE === true) {
            const isTraceTarget = (
                (empId.includes('miriam') || empId.includes('cristina')) &&
                (date >= '2026-04-15' && date <= '2026-04-17')
            );
            if (isTraceTarget) {
                console.log("[RESOLVE TRACE]", {
                    empleadoMostrado: result.empleadoNombre,
                    empleadoReal: empId,
                    titularCubierto: result.sustituyeA,
                    fecha: date,
                    hotel: hotel,
                    turnoBaseTitular: result.sustituyeA ? window.getTurnoBaseDeEmpleado(result.sustituyeA, date, baseIndex) : null,
                    turnoBaseEmpleado: result.turnoBase,
                    eventoAusencia: result.incidencia,
                    eventoCT: (result.intercambio || result.origen === 'CAMBIO_TURNO') ? result.origen : null,
                    origenFinal: result.origen,
                    turnoFinal: result.turno
                });
            }
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

    // ── HELPERS DE PRESENTACION: texto limpio e iconos decorativos ──────────────

    /**
     * cleanTurnoLabel(value)
     * Devuelve el texto canonico limpio del turno/incidencia.
     * Elimina emojis, bytes corruptos y normaliza codigos a nombres completos.
     * El valor devuelto es SOLO texto — nunca incluye iconos.
     *
     * @param {string} value - Codigo o nombre crudo (ej. 'M', 'VAC', 'Vacaciones', 'Baja 🤒')
     * @returns {string} Texto limpio ('Manana', 'Vacaciones', 'Baja', etc.)
     */
    window.cleanTurnoLabel = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        // 1. Limpiar bytes corruptos y emojis
        let s = String(value)
            .replace(/[^\x00-\x7F\u00C0-\u024F\u00e0-\u00ff\u00f1\u00d1]/g, '') // latin + spanish chars
            .trim();
        // 2. Normalizar a mayusculas sin acentos para comparar
        const up = s.toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '');
        // 3. Mapa de codigos → etiqueta canonica
        const MAP = {
            'M': 'Mañana', 'MANANA': 'Mañana', 'MANANA': 'Mañana',
            'T': 'Tarde',  'TARDE': 'Tarde',
            'N': 'Noche',  'NOCHE': 'Noche',
            'D': 'Descanso', 'DESCANSO': 'Descanso',
            'VAC': 'Vacaciones', 'VACACION': 'Vacaciones', 'VACACIONES': 'Vacaciones',
            'BAJA': 'Baja', 'BAJAMEDICA': 'Baja', 'BM': 'Baja',
            'PERM': 'Permiso', 'PERMISO': 'Permiso', 'PERMISOS': 'Permiso',
            'FORM': 'Formación', 'FORMACION': 'Formación', 'FORMACION': 'Formación',
            '-': '—', '': '—'
        };
        if (MAP[up] !== undefined) return MAP[up];
        // 4. Coincidencia parcial para etiquetas compuestas ('VACACIONES_EXTRA', etc.)
        if (up.startsWith('VAC')) return 'Vacaciones';
        if (up.startsWith('BAJ')) return 'Baja';
        if (up.startsWith('PER')) return 'Permiso';
        if (up.startsWith('FOR')) return 'Formación';
        // 5. Devolver texto limpio si no hay mapeo
        return s || '—';
    };

    /**
     * getTurnoIcon(turno, flags)
     * Devuelve el icono decorativo (emoji) para un turno/incidencia.
     * El icono es solo decoracion visual — nunca se guarda en Supabase ni se usa en logica.
     *
     * @param {string} turno - Tipo de turno o incidencia
     * @param {object} [flags] - { cambio, intercambio }
     * @returns {string} Emoji o '' si no hay icono para ese turno
     */
    window.getTurnoIcon = (turno, flags = {}) => {
        if (!turno) return '';
        const up = String(turno).toUpperCase()
            .replace(/[^\x00-\x7F]/g, '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '');
        if (up.startsWith('VAC'))                return '\uD83C\uDFD6\uFE0F'; // 🏖️
        if (up === 'BAJA' || up.startsWith('BAJ')) return '\uD83E\uDD12';       // 🤒
        if (up.startsWith('PER'))                return '\uD83D\uDDD3\uFE0F'; // 🗓️
        if (up.startsWith('FOR'))                return '\uD83C\uDF93';         // 🎓
        if (up === 'N' || up === 'NOCHE')        return '\uD83C\uDF19';
        // El icono de intercambio SOLO para CT real, no para sustitución por ausencia
        if (flags.intercambio) return '\uD83D\uDD03'; // 🔃
        return '';
    };

    /**
     * window.debugResolveEmpleadoDia({ empleado, hotel, fecha })
     * Función de diagnóstico estructural para validar la resolución de un turno.
     */
    window.debugResolveEmpleadoDia = ({ empleado, hotel, fecha }) => {
        const baseIndex = window._lastBaseIndex;
        const eventos = window._lastEventos || [];
        
        const res = window.resolveEmployeeDay({
            empleadoId: empleado,
            hotel,
            fecha,
            eventos,
            baseIndex
        });

        console.group(`%c[DEBUG RESOLVE] ${empleado} @ ${fecha}`, "color: #8b5cf6; font-weight: bold;");
        console.log("Empleado Visible:", res.empleadoNombre);
        console.log("Empleado Real (ID):", res.empleadoId);
        console.log("Hotel:", hotel);
        console.table((eventos || [])
            .filter(ev => window.eventoAplicaEnFecha(ev, fecha))
            .map(ev => ({
                tipo: window.normalizeTipo(ev.tipo),
                hotelEvento: window.getEventoHotel(ev) || '(sin hotel)',
                titular: ev.empleado_id || ev.titular_id || ev.titular || '',
                sustituto: ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || '',
                matchHotel: window.eventoPerteneceAHotel(ev, hotel),
                matchEmpleado: window.eventoPerteneceAEmpleado(ev, empleado, { hotel })
            })));
        console.log("Posición/Titular Cubierto:", res.sustituyeA || 'Ninguno (Titular)');
        console.log("Evento Ausencia:", res.incidencia || 'No');
        console.log("Evento CT:", res.intercambio ? 'Sí' : 'No');
        console.log("Turno Base Titular:", res.sustituyeA ? window.getTurnoBaseDeEmpleado(res.sustituyeA, fecha, baseIndex) : res.turnoBase);
        console.log("Turno Base Sustituto:", res.turnoBase);
        console.log("Origen Final:", res.origen);
        console.log("Turno Final:", res.turno);
        console.groupEnd();
        
        return res;
    };
    
    // Alias solicitado por el usuario
    window.getTurnoEmoji = window.getTurnoIcon;

    /**
     * renderTurnoContent(turno, flags)
     * Renderiza el contenido de una celda de turno con label e icono separados.
     * El texto es el dato limpio. El emoji es decoracion visual separada.
     */
    window.renderTurnoContent = (turno, flags = {}) => {
        const label = window.cleanTurnoLabel(turno);
        const icons = [];
        const turnoIcon = window.getTurnoIcon(turno, {});
        if (turnoIcon) icons.push(turnoIcon);
        if (flags.intercambio) icons.push('\uD83D\uDD03');
        
        // El label nunca debe contener iconos.
        // Los iconos van en spans separados con aria-hidden.
        let html = `<span class="turno-label">${label}</span>`;
        [...new Set(icons)].forEach(icon => {
            html += ` <span class="turno-icon" aria-hidden="true">${icon}</span>`;
        });
        return html;
    };

})();
