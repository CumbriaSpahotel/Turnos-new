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

    window.isPlaceholderId = (id) => {
        if (!id) return true;
        const norm = window.normalizeId(id);
        return norm.includes('vacante') || 
               norm.includes('placeholder') || 
               norm.includes('sin asignar') || 
               norm.includes('---') ||
               norm.includes('___');
    };

    window.getEmployeeStructuralType = (emp) => {
        if (!emp) return 'fijo';

        const idNorm = window.normalizeId(emp.id || emp.nombre || '');
        if (!idNorm || idNorm.includes('vacante') || idNorm.includes('placeholder') || idNorm.includes('sin asignar') || idNorm.includes('---') || emp.isVacante === true || emp.placeholder === true) return 'placeholder';
        if (emp.activo === false || window.normalizeId(emp.estado_empresa || emp.estado || '').includes('baja')) return 'baja_empresa';

        if (emp.tipo_trabajador === 'apoyo' || emp.es_apoyo === true || emp.apoyo === true) return 'apoyo';
        if (emp.occasional === true || emp.eventual === true) return 'ocasional';

        const text = [
            emp.tipo_personal,
            emp.tipo,
            emp.contrato,
            emp.categoria,
            emp.tags
        ].filter(Boolean).join(' ');

        const normalizedText = window.normalizeId(text);
        if (/temporada|seasonal|campana/.test(normalizedText)) return 'temporada';
        if (/apoyo|personal de apoyo/.test(normalizedText)) return 'apoyo';
        if (/ocasional|eventual|trabajador ocasional/.test(normalizedText)) return 'ocasional';
        if (/placeholder|vacante/.test(normalizedText)) return 'placeholder';
        if (/baja_empresa|inactivo/.test(normalizedText)) return 'baja_empresa';
        return 'fijo';
    };

    window.isEmpleadoOcasionalOApoyo = (emp) => {
        if (!emp) return false;
        if (emp.excludeCounters) return true;
        const structuralType = window.getEmployeeStructuralType(emp);
        return structuralType === 'apoyo' || structuralType === 'ocasional';
    };

    window.shouldShowEmployeeCounters = (emp, row) => {
        if (!emp) return true;
        const isSupport = window.isEmpleadoOcasionalOApoyo?.(emp) || (row && row.excludeCounters === true);
        const hasOperationalData = (row) => {
            if (!row) return false;
            if (row.esCoberturaAusencia || row.titular_cubierto || row.sustituyeA || row.origen === 'sustitucion') return true;
            if (row.dias) {
                return Object.values(row.dias).some(d => d.titular_cubierto || d.origen === 'sustitucion' || d.origen === 'vacaciones');
            }
            if (row.cells) {
                return row.cells.some(c => c.titular || c.sustituyeA || c.tipo === 'VAC' || c.origen === 'sustitucion');
            }
            return false;
        };
        const isOperationalCover = hasOperationalData(row);
        if (isOperationalCover) return true;
        if (isSupport) return false;
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
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
        if (dmyMatch) {
            const day   = dmyMatch[1].padStart(2, '0');
            const month = dmyMatch[2].padStart(2, '0');
            let   year  = dmyMatch[3];
            if (year.length === 2) year = (Number(year) > 50 ? '19' : '20') + year;
            return `${year}-${month}-${day}`;
        }
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
        return s.split(/[T ]/)[0];
    };

    window.normalizeTipo = (value) => {
        const v = String(value || '')
            .replace(/[^\x00-\x7F]/g, '')
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+$/, '');
        
        if (v.startsWith('VAC')) return 'VAC'; 
        if (v.includes('BAJA') || v.includes('IT') || v.includes('INCAPACIDAD') || v.startsWith('BM')) return 'BAJA';
        if (v.startsWith('PERM')) return 'PERM'; 
        if (v === 'CT' || v === 'CAMBIO_TURNO' || v === 'CAMBIO_DE_TURNO' || v === 'CAMBIO_DE_TURNOS') return 'CAMBIO_TURNO';
        if (v === 'INTERCAMBIO' || v === 'INTERCAMBIO_TURNO' || v === 'INTERCAMBIO_DE_TURNO' || v === 'INTERCAMBIO_DE_TURNOS') return 'INTERCAMBIO_TURNO';
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
        if (['finalizado', 'finalizada', 'completado', 'completada', 'ok', 'aprobado', 'aprobada', 'activo'].includes(v)) return 'activo';
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
        if (!eventHotel) return true;
        const rowHotel = window.normalizeId(hotel);
        if (!rowHotel) return true; 
        const matches = eventHotel === rowHotel;
        if (!matches && window.DEBUG_MODE === true) {
            console.warn('[MATCH HOTEL DESCARTADO]', { eventHotel, rowHotel, evento });
        }
        return matches;
    };

    window.isTitularOfAbsence = (evento, empleadoId, context = {}) => {
        const target = window.normalizeId(empleadoId);
        if (!target) return false;
        const candidatosTitular = [
            evento.empleado_id, evento.empleado_a_id, evento.origen_id, evento.empleado,
            evento.empleado_nombre, evento.nombre, evento.titular, evento.titular_id,
            evento.id_empleado, evento.participante_a, evento.payload?.empleado_id
        ].filter(Boolean).map(window.normalizeId);
        const normalizedTarget = context.resolveId ? context.resolveId(target) : target;
        return candidatosTitular.some(c => {
            const normalizedC = context.resolveId ? context.resolveId(c) : c;
            return normalizedC === normalizedTarget;
        });
    };

    window.eventoPerteneceAEmpleado = (evento, empleadoId, context = {}) => {
        const target = window.normalizeId(empleadoId);
        if (!target) return false;
        if (context.hotel && !window.eventoPerteneceAHotel(evento, context.hotel)) return false;
        const tipo = window.normalizeTipo(evento.tipo);
        const candidatosTitular = [
            evento.empleado_id, evento.empleado_a_id, evento.origen_id, evento.empleado,
            evento.empleado_nombre, evento.nombre, evento.titular, evento.titular_id,
            evento.id_empleado, evento.participante_a, evento.payload?.empleado_id
        ].filter(Boolean).map(window.normalizeId);
        const candidatosDestino = [
            evento.empleado_destino_id, evento.empleado_b_id, evento.destino_id, evento.sustituto_id,
            evento.empleado_destino, evento.empleado_destino_nombre, evento.sustituto, evento.participante_b,
            evento.payload?.empleado_destino_id, evento.payload?.sustituto_id, evento.payload?.sustituto
        ].filter(Boolean).map(window.normalizeId);
        const candidatos = [...new Set([...candidatosTitular, ...candidatosDestino])];
        if (candidatos.includes(target)) return true;
        return false;
    };

    window.getOtroEmpleadoDelCambio = (evento, empleadoId) => {
        const target = window.normalizeId(empleadoId);
        const candidatosA = [
            evento.empleado_id, evento.empleado_a_id, evento.origen_id, evento.empleado,
            evento.empleado_nombre, evento.nombre, evento.titular, evento.titular_id,
            evento.id_empleado, evento.participante_a, evento.payload?.empleado_id
        ].filter(Boolean).map(window.normalizeId);
        const candidatosB = [
            evento.empleado_destino_id, evento.empleado_b_id, evento.destino_id, evento.sustituto_id,
            evento.empleado_destino, evento.empleado_destino_nombre, evento.sustituto, evento.participante_b,
            evento.payload?.empleado_destino_id, evento.payload?.sustituto_id, evento.payload?.sustituto
        ].filter(Boolean).map(window.normalizeId);
        const isA = candidatosA.includes(target);
        const isB = candidatosB.includes(target);
        if (isA) return candidatosB[0] || '';
        if (isB) return candidatosA[0] || '';
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
                if (val === null || val === undefined || String(val).trim() === '') return '—';
                const v = String(val).trim().toUpperCase();
                if (v === 'D' || v === 'DESCANSO') return 'D';
                return val;
            }
            return null;
        };
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
                const titularNorm = window.normalizeId(titularIdReal);
                const valTitular = tryGet(titularNorm);
                if (valTitular !== null) return valTitular;
            }
        }
        let res = tryGet(normId);
        if (res !== null) return res;
        const alias = baseIndex.aliasesEmpleado?.get(normId);
        if (alias) {
            res = tryGet(alias);
            if (res !== null) return res;
        }
        return null;
    };

    window.getTurnoOperativoBase = (empleadoId, fecha, context = {}) => {
        const baseIndex = context.baseIndex || context;
        const events = context.eventos || [];
        const empIdNorm = window.normalizeId(empleadoId);
        const subEvent = events.find(ev => {
            const fi = window.normalizeDate(ev.fecha_inicio || ev.desde || ev.fecha);
            const ff = window.normalizeDate(ev.fecha_fin || ev.hasta || ev.fecha_inicio || ev.fecha);
            if (fecha < fi || fecha > ff) return false;
            const t = window.normalizeTipo(ev.tipo);
            if (t !== 'SUSTITUCION' && t !== 'COBERTURA' && t !== 'VAC' && t !== 'BAJA' && t !== 'PERMISO') return false;
            const destId = window.normalizeId(ev.empleado_destino_id || ev.destino_id || ev.sustituto_id || ev.participante_b);
            const sustNombre = ev.sustituto ? window.normalizeId(ev.sustituto) : null;
            return destId === empIdNorm || sustNombre === empIdNorm;
        });
        if (subEvent) {
            const titularId = window.normalizeId(subEvent.empleado_id || subEvent.titular_id || subEvent.titular);
            if (titularId) {
                const titularTurno = window.getTurnoBaseDeEmpleado(titularId, fecha, baseIndex);
                if (titularTurno) return titularTurno;
            }
        }
        const turno = window.getTurnoBaseDeEmpleado(empleadoId, fecha, baseIndex);
        return (turno === null || turno === undefined || String(turno).trim() === '') ? null : turno;
    };

    window.getOperationalOccupant = (empId, date, events, hotel, context = {}) => {
        const normId = window.normalizeId(empId);
        if (!normId) return null;
        const maps = context.baseIndex || context;
        if (maps.operationalOccupantByOriginalEmployeeId) {
            const dayMap = maps.operationalOccupantByOriginalEmployeeId.get(date);
            if (dayMap && dayMap.has(normId)) {
                const sustId = dayMap.get(normId);
                return window.getOperationalOccupant(sustId, date, events, hotel, context);
            }
            return normId;
        }
        const ev = events.find(e => 
            window.normalizeEstado(e.estado) !== 'anulado' &&
            window.eventoAplicaEnFecha(e, date) &&
            window.isTitularOfAbsence(e, normId) &&
            ['VAC', 'BAJA', 'PERMISO', 'PERM', 'FORMACION', 'IT', 'SUSTITUCION', 'COBERTURA'].includes(window.normalizeTipo(e.tipo)) &&
            (e.empleado_destino_id || e.sustituto_id || e.sustituto || e.payload?.sustituto_id || e.payload?.sustituto)
        );
        if (ev) {
            const sustId = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto);
            if (sustId && sustId !== normId) {
                return window.getOperationalOccupant(sustId, date, events, hotel, context);
            }
        }
        return normId;
    };

    const PRIORITY_RANK = {
        'BAJA': 1, 'VAC': 2, 'VACACIONES': 2, 'PERMISO': 3, 'PERM': 3, 'FORMACION': 4, 'FORM': 4,
        'SUSTITUCION': 5, 'COBERTURA': 5, 'INTERCAMBIO_TURNO': 6, 'CT': 6, 'CAMBIO_TURNO': 6, 'BASE': 7, 'SIN_TURNO': 8
    };

    const canonicalShiftToken = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return raw.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
    };

    window.isValidShiftValue = (value) => {
        const t = canonicalShiftToken(value);
        return ["M", "T", "N", "D", "MANANA", "MAANA", "TARDE", "NOCHE", "DESCANSO"].includes(t);
    };

    window.isInvalidLegacyChangeValue = (value) => {
        const t = String(value || "").trim().toUpperCase();
        return ["CT", "CAMBIO", "CAMBIO_TURNO", "INTERCAMBIO", "INTERCAMBIO_TURNO"].includes(t);
    };

    window.normalizeShiftValue = (value) => {
        if (window.TurnosRules && window.TurnosRules.isEmptyShift && window.TurnosRules.isEmptyShift(value)) return null;
        const t = canonicalShiftToken(value);
        if (!t || t === '-') return null;
        if (t === "M" || t === "MANANA" || t === "MAANA") return "M";
        if (t === "T" || t === "TARDE") return "T";
        if (t === "N" || t === "NOCHE") return "N";
        if (t === "D" || t === "DESCANSO") return "D";
        return null;
    };

    window.resolveEmployeeDay = ({ empleadoId, fecha, eventos = [], baseIndex = {}, hotel = '' }) => {
        const empId = window.normalizeId(empleadoId);
        const date = window.normalizeDate(fecha);
        const context = { baseIndex, eventos, hotel };

        const result = {
            empleadoId: empId,
            fecha: date,
            turno: window.getTurnoOperativoBase(empId, date, context) || '—',
            turnoBase: window.getTurnoBaseDeEmpleado(empId, date, baseIndex),
            incidencia: null,
            cambio: false,
            intercambio: false,
            sustituyeA: null,
            sustituidoPor: null,
            incidenciaCubierta: null,
            origen: 'BASE',
            icon: '',
            icons: []
        };

        const isDiagTarget = window.DEBUG_MODE && (window.DIAG_EMP === empId || !window.DIAG_EMP);

        const titularesSubstituidos = [];
        eventos.forEach(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (!window.eventoAplicaEnFecha(ev, date)) return;
            const destId = window.normalizeId(ev.empleado_destino_id || ev.destino_id || ev.sustituto_id || ev.participante_b);
            if (destId === empId) {
                const tId = window.normalizeId(ev.empleado_id || ev.titular_id || ev.titular);
                if (tId && tId !== empId) titularesSubstituidos.push(tId);
            }
        });

        const eventosActivos = eventos.filter(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return false;
            if (!window.eventoAplicaEnFecha(ev, date)) return false;
            if (window.eventoPerteneceAEmpleado(ev, empId, { hotel })) return true;
            const tipo = window.normalizeTipo(ev.tipo);
            if (['INTERCAMBIO_TURNO', 'CAMBIO_TURNO', 'CT'].includes(tipo)) {
                return titularesSubstituidos.some(tId => window.eventoPerteneceAEmpleado(ev, tId, { hotel }));
            }
            return false;
        });

        eventosActivos.sort((a, b) => (PRIORITY_RANK[window.normalizeTipo(a.tipo)] || 99) - (PRIORITY_RANK[window.normalizeTipo(b.tipo)] || 99));

        for (const ev of eventosActivos) {
            const tipo = window.normalizeTipo(ev.tipo);

            if (['VAC', 'BAJA', 'PERMISO', 'PERM', 'FORMACION', 'FORM'].includes(tipo) && window.isTitularOfAbsence(ev, empId)) {
                result.incidencia = tipo;
                result.turno = null;
                result.origen = tipo;
                result.icon = window.getTurnoIcon(tipo);
                result.icons = [result.icon];
                const sustId = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.participante_b);
                if (sustId && sustId !== empId) result.sustituidoPor = sustId;
                break;
            }

            if (['VAC', 'BAJA', 'PERMISO', 'SUSTITUCION', 'COBERTURA'].includes(tipo) && !window.isTitularOfAbsence(ev, empId)) {
                const tId = window.normalizeId(ev.empleado_id || ev.titular_id || ev.titular);
                result.sustituyeA = tId;
                result.incidenciaCubierta = tipo;
                result.origen = tipo;
                result.turno = window.getTurnoBaseDeEmpleado(tId, date, baseIndex) || '—';
                continue;
            }

            if (['INTERCAMBIO_TURNO', 'CAMBIO_TURNO', 'CT'].includes(tipo)) {
                const requestedA = window.normalizeId(ev.empleado_id || ev.titular_id || ev.titular);
                const requestedB = window.normalizeId(ev.empleado_destino_id || ev.destino_id || ev.sustituto_id || ev.participante_b);
                const resolvedA = window.getOperationalOccupant(requestedA, date, eventos, hotel, { baseIndex });
                const resolvedB = window.getOperationalOccupant(requestedB, date, eventos, hotel, { baseIndex });
                const isOrigin = empId === resolvedA;
                const isDestination = empId === resolvedB;

                if (isOrigin || isDestination) {
                    let tOrigRaw = ev.turno_original || ev.turno_origen;
                    let tDestRaw = ev.turno_nuevo || ev.turno_destino;
                    const isLegacyCT = window.isInvalidLegacyChangeValue(tOrigRaw) || window.isInvalidLegacyChangeValue(tDestRaw);
                    const tOpA = (isOrigin ? result.turno : window.getTurnoOperativoBase(requestedA, date, { baseIndex, eventos })) || '—';
                    const tOpB = (isDestination ? result.turno : window.getTurnoOperativoBase(requestedB, date, { baseIndex, eventos })) || '—';
                    
                    const eventOrigCode = window.normalizeShiftValue(tOrigRaw);
                    const eventDestCode = window.normalizeShiftValue(tDestRaw);
                    const baseOrigCode = window.normalizeShiftValue(tOpA);
                    const baseDestCode = window.normalizeShiftValue(tOpB);
                    const hasComparableEvent = Boolean(eventOrigCode && eventDestCode);
                    const isIncoherente = hasComparableEvent && ((baseOrigCode && eventOrigCode !== baseOrigCode) || (baseDestCode && eventDestCode !== baseDestCode));

                    let finalTurnoOrigen = tDestRaw;
                    let finalTurnoDestino = tOrigRaw;

                    if (!window.isValidShiftValue(tOrigRaw) || !window.isValidShiftValue(tDestRaw) || isLegacyCT || isIncoherente) {
                        finalTurnoOrigen = tOpB;
                        finalTurnoDestino = tOpA;
                    }
                    result.turno = isOrigin ? finalTurnoOrigen : finalTurnoDestino;
                    result.cambio = true;
                    result.intercambio = true;
                    result.icon = '\u{1F504}';
                    result.icons = ['\u{1F504}'];
                    result.origen = tipo;
                }
            }
        }
        
        result.turnoFinal = result.turno;
        result.isModified = result.cambio;
        result.isAbsence = !!result.incidencia;
        result.estadoFinal = result.incidencia || (result.turno === 'D' ? 'DESCANSO' : 'NORMAL');
        result.sourceReason = result.incidencia ? `EVENTO_${result.origen}` : (result.turnoBase ? 'BASE_PLANNING' : 'SIN_TURNO');
        result.coversEmployeeId = result.sustituyeA;
        result.coveredByEmployeeId = result.sustituidoPor;
        result.coveredType = result.incidenciaCubierta;
        result.rol = result.sustituyeA ? 'sustituto' : 'titular';
        result.cubierto_por = result.sustituidoPor;

        if (result.turno === 'CT' || window.isInvalidLegacyChangeValue(result.turno)) {
            result.turno = result.turnoBase || '—';
            result.isModified = false;
        }
        if (result.turno && result.turno !== '—' && result.turno !== 'D') {
            result.isAbsence = false;
        }
        return result;
    };

    window.buildIndices = (employees = [], events = [], baseRows = []) => {
        const baseIndex = { porEmpleadoFecha: new Map(), porHotelFecha: new Map(), aliasesEmpleado: new Map() };
        const eventIndex = { porEmpleadoFecha: new Map(), porFecha: new Map(), porHotelFecha: new Map() };
        employees.forEach(emp => {
            const id = window.normalizeId(emp.id);
            const nombre = window.normalizeId(emp.nombre);
            if (id && nombre) baseIndex.aliasesEmpleado.set(nombre, id);
        });
        baseRows.forEach(row => {
            const empId = window.normalizeId(row.empleadoId || row.empleado_id);
            const date = window.normalizeDate(row.fecha);
            if (empId && date) baseIndex.porEmpleadoFecha.set(`${empId}_${date}`, row.turno);
        });
        events.forEach(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            const date = window.normalizeDate(ev.fecha_inicio || ev.fecha);
            if (!eventIndex.porFecha.has(date)) eventIndex.porFecha.set(date, []);
            eventIndex.porFecha.get(date).push(ev);
        });
        return { baseIndex, eventIndex };
    };

    window.cleanTurnoLabel = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        let s = String(value).trim();
        s = s.replaceAll('Mañana', 'Mañana').replaceAll('Formación', 'Formación').replaceAll('Permiso', 'Permiso');
        const up = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
        const MAP = {
            'M': 'Mañana', 'MANANA': 'Mañana', 'T': 'Tarde', 'TARDE': 'Tarde', 'N': 'Noche', 'NOCHE': 'Noche',
            'D': 'Descanso', 'DESCANSO': 'Descanso', 'VAC': 'Vacaciones', 'VACACIONES': 'Vacaciones',
            'BAJA': 'Baja', 'PERMISO': 'Permiso', 'FORMACION': 'Formación', '-': '—', '': '—'
        };
        return MAP[up] || s || '—';
    };

    window.getTurnoIcon = (turno, flags = {}) => {
        if (!turno) return '';
        const up = String(turno).toUpperCase().replace(/[^\x00-\x7F]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
        if (up.startsWith('VAC')) return '\uD83C\uDFD6\uFE0F';
        if (up.startsWith('BAJ')) return '\uD83E\uDD12';
        if (up.startsWith('PER')) return '\uD83D\uDDD3\uFE0F';
        if (up.startsWith('FOR')) return '\uD83C\uDF93';
        if (up === 'N' || up === 'NOCHE') return '\uD83C\uDF19';
        if (flags.intercambio) return '\uD83D\uDD03';
        return '';
    };

    window.renderTurnoContent = (turno, flags = {}) => {
        const label = window.cleanTurnoLabel(turno);
        const icons = [];
        const tIcon = window.getTurnoIcon(turno, {});
        if (tIcon) icons.push(tIcon);
        if (flags.intercambio) icons.push('\uD83D\uDD03');
        let html = `<span class="turno-label">${label}</span>`;
        [...new Set(icons)].forEach(icon => { html += ` <span class="turno-icon" aria-hidden="true">${icon}</span>`; });
        return html;
    };

    window.ShiftResolver = {
        resolveEmployeeDay: window.resolveEmployeeDay,
        buildIndices: window.buildIndices,
        clearCache: () => _cache.clear()
    };
    window.resolverTurnoFinal = window.resolveEmployeeDay;

    console.log("[ShiftResolver] Carga finalizada v5.0.");
})();
