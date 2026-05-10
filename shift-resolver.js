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

    window.normalizePersonKey = window.normalizePersonKey || ((nombre) => {
        if (nombre === null || nombre === undefined) return '';
        let s = String(nombre);
        s = s.replace(/<[^>]*>/g, ' ');
        s = s.replace(/[\u00A0\u202F]/g, ' ');
        s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        s = s.replace(/\s+/g, ' ').trim().toLowerCase();
        return s;
    });

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
        if (['anulado', 'anulada', 'rechazado', 'rechazada', 'cancelado', 'cancelada', 'denegado', 'denegada'].includes(v)) return 'anulado';
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

    window.getEventOriginCandidates = (evento = {}) => {
        const p = evento.payload || {};
        return [
            evento.empleado_id, evento.empleado_a_id, evento.origen_id,
            evento.empleado, evento.empleado_nombre, evento.nombre,
            evento.titular, evento.titular_id, evento.id_empleado, evento.solicitante, evento.origen,
            evento.participante_a, p.empleado_id, p.solicitante,
            p.solicitante_id, p.titular, p.titular_id, p.origen
        ].filter(Boolean);
    };

    window.getEventOriginRaw = (evento = {}) => window.getEventOriginCandidates(evento)[0] || '';

    window.getEventDestinationCandidates = (evento = {}) => {
        const p = evento.payload || {};
        return [
            evento.empleado_destino_id, evento.empleado_b_id, evento.destino_id,
            evento.destino, evento.sustituto_id, evento.empleado_destino, evento.empleado_destino_nombre,
            evento.sustituto, evento.sustituto_nombre, evento.participante_b,
            evento.companero, evento['compañero'], evento.participante_destino, evento.destinatario, p.empleado_destino_id,
            p.empleado_b_id, p.destino_id, p.destino, p.sustituto_id, p.empleado_destino,
            p.empleado_destino_nombre, p.sustituto, p.sustituto_nombre,
            p.participante_b, p.participante_destino, p.companero, p['compa\u00f1ero'],
            p.companero_id, p.destinatario, p.destinatario_id
        ].filter(Boolean);
    };

    window.getEventDestinationRaw = (evento = {}) => window.getEventDestinationCandidates(evento)[0] || '';

    /**
     * [NUEVO] Unificación de la normalización de eventos de cambio/intercambio.
     * Asegura que siempre se obtenga un origen y destino coherente, priorizando nombres reales sobre '¿?'.
     */
    window.normalizeCambioEvento = (ev) => {
        if (!ev) return null;
        const originCandidates = window.getEventOriginCandidates ? window.getEventOriginCandidates(ev) : [ev.empleado_id];
        const destinationCandidates = window.getEventDestinationCandidates ? window.getEventDestinationCandidates(ev) : [ev.empleado_destino_id];
        
        // Filtro para evitar placeholders como "¿?" si existe una alternativa real
        const filterPlaceholder = (list) => list.find(c => c && !['¿?', '?', 'DESCONOCIDO', 'NULL', 'UNDEFINED'].includes(String(c).trim().toUpperCase()));
        
        const rawOrigin = filterPlaceholder(originCandidates) || originCandidates[0] || '';
        const rawDestination = filterPlaceholder(destinationCandidates) || destinationCandidates[0] || '';

        const normalized = {
            id: ev.id,
            fecha: window.normalizeDate ? window.normalizeDate(ev.fecha_inicio || ev.fecha) : (ev.fecha_inicio || ev.fecha || ''),
            hotel: window.getEventoHotel ? window.getEventoHotel(ev) : (ev.hotel || ev.hotel_id || ''),
            tipo: window.normalizeTipo ? window.normalizeTipo(ev.tipo) : String(ev.tipo || '').toUpperCase(),
            estado: window.normalizeEstado ? window.normalizeEstado(ev.estado) : String(ev.estado || '').toLowerCase(),
            origen: rawOrigin,
            destino: rawDestination,
            idOrig: window.normalizeId ? window.normalizeId(rawOrigin) : String(rawOrigin).toLowerCase().trim(),
            idDest: window.normalizeId ? window.normalizeId(rawDestination) : String(rawDestination).toLowerCase().trim(),
            turnoOrigen: (window.fixMojibake || (v=>v))(ev.turno_original || ev.turno_origen || ev.turno_solicitado || ev.payload?.turno_original || ev.payload?.turno_origen || ev.payload?.turno_solicitado || ev.payload?.origen),
            turnoDestino: (window.fixMojibake || (v=>v))(ev.turno_nuevo || ev.turno_destino || ev.payload?.turno_nuevo || ev.payload?.turno_destino || ev.payload?.destino)
        };

        if (
            normalized.fecha === '2026-10-21' &&
            window.normalizePersonKey(normalized.hotel) === window.normalizePersonKey('Sercotel Guadiana') &&
            window.normalizePersonKey(normalized.origen) === 'dani'
        ) {
            console.log(`[EVENTO_NORMALIZADO_TARGET]
fecha=${normalized.fecha}
hotel=${normalized.hotel}
origen=${normalized.origen}
destino=${normalized.destino}
turnoOrigen=${normalized.turnoOrigen}
turnoDestino=${normalized.turnoDestino}
estado=${normalized.estado}
tipo=${normalized.tipo}`);
        }
        return normalized;
    };

    window.isTitularOfAbsence = (evento, empleadoId, context = {}) => {
        const target = window.normalizeId(empleadoId);
        if (!target) return false;
        const candidatosTitular = window.getEventOriginCandidates(evento).map(window.normalizeId);
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
        const candidatosTitular = window.getEventOriginCandidates(evento).map(window.normalizeId);
        const candidatosDestino = window.getEventDestinationCandidates(evento).map(window.normalizeId);
        const candidatos = [...new Set([...candidatosTitular, ...candidatosDestino])];
        const strippedTarget = target.replace(/^(vacante|placeholder)-?/, '');
        if (candidatos.includes(target) || candidatos.includes(strippedTarget)) return true;
        return false;
    };

    window.getOtroEmpleadoDelCambio = (evento, empleadoId) => {
        const target = window.normalizeId(empleadoId);
        const candidatosA = window.getEventOriginCandidates(evento).map(window.normalizeId);
        const candidatosB = window.getEventDestinationCandidates(evento).map(window.normalizeId);
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
        const date = window.normalizeDate(fecha);

        // REGLA MAESTRA V12.8: Evitar recursividad infinita al resolver bases operativas
        if (context._isResolvingRecursive) {
            return window.getTurnoBaseDeEmpleado(empleadoId, fecha, baseIndex);
        }

        // Si el motor de resolución está disponible, lo usamos para obtener el estado "pre-cambio"
        // Esto permite que los sustitutos de vacaciones/baja tengan un turno válido para intercambios
        // incluso si el titular no está correctamente indexado en el Excel base.
        if (window.resolveEmployeeDay) {
            try {
                const res = window.resolveEmployeeDay({
                    empleadoId: empIdNorm,
                    fecha: date,
                    eventos: events,
                    baseIndex: baseIndex,
                    hotel: context.hotel || '',
                    skipChanges: true, 
                    _isResolvingRecursive: true
                });
                if (res && res.turno && res.turno !== '—') return res.turno;
            } catch (e) {
                if (window.DEBUG_MODE) console.warn('[ShiftResolver] Fallo en resolveEmployeeDay recursivo:', e);
            }
        }

        const turno = window.getTurnoBaseDeEmpleado(empIdNorm, date, baseIndex);
        return (turno === null || turno === undefined || String(turno).trim() === '' || turno === '—') ? null : turno;
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
            (window.getEventDestinationRaw(e))
        );
        if (ev) {
            const sustId = window.normalizeId(window.getEventDestinationRaw(ev));
            if (sustId && sustId !== normId) {
                return window.getOperationalOccupant(sustId, date, events, hotel, context);
            }
        }
        return normId;
    };

    const PRIORITY_RANK = {
        VAC: 1,
        BAJA: 2,
        PERMISO: 3,
        PERM: 3,
        FORMACION: 4,
        SUSTITUCION: 5,
        COBERTURA: 5,
        INTERCAMBIO_TURNO: 6,
        CAMBIO_TURNO: 7,
        CT: 7
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

    window.resolveEmployeeDay = ({ empleadoId, fecha, eventos = [], baseIndex = {}, hotel = '', skipChanges = false, _isResolvingRecursive = false }) => {
        const empId = window.normalizeId(empleadoId);
        const date = window.normalizeDate(fecha);
        const context = { baseIndex, eventos, hotel, _isResolvingRecursive };
        const isDiagTarget = empId === 'proximamente' || empId === 'dani' || empId === '¿?' || empId === '?';

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


        const titularesSubstituidos = [];
        eventos.forEach(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (!window.eventoAplicaEnFecha(ev, date)) return;
            const destId = window.normalizeId(window.getEventDestinationRaw(ev));
            if (destId === empId) {
                const tId = window.normalizeId(window.getEventOriginRaw(ev));
                if (tId && tId !== empId) titularesSubstituidos.push(tId);
            }
        });

        // PLACEHOLDER_ALIAS: La fila '¿?' es el ocupante operativo del slot 'Proximamente'
        // Cuando el destino de un INTERCAMBIO es 'Proximamente' (u otro nombre no-placeholder),
        // esa fila '¿?' DEBE recibir el intercambio como destino.
        const isPlaceholderRow = empId === '¿?' || empId === '?';
        const eventosActivos = eventos.filter(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return false;
            if (!window.eventoAplicaEnFecha(ev, date)) return false;
            if (window.eventoPerteneceAEmpleado(ev, empId, { hotel })) return true;
            const tipo = window.normalizeTipo(ev.tipo);
            if (['INTERCAMBIO_TURNO', 'CAMBIO_TURNO', 'CT'].includes(tipo)) {
                // Caso sustituto: el evento pertenece a un titular que esta cubierto por este empleado
                if (titularesSubstituidos.some(tId => window.eventoPerteneceAEmpleado(ev, tId, { hotel }))) return true;
                // Caso placeholder: la fila '¿?' recibe intercambios cuyo destino es un nombre no-placeholder
                if (isPlaceholderRow) {
                    const destCandidates = window.getEventDestinationCandidates(ev).map(window.normalizeId);
                    const destHasNonPlaceholder = destCandidates.some(d => d && d !== '¿?' && d !== '?' && d !== '' && d !== 'null' && d !== 'undefined');
                    if (destHasNonPlaceholder && window.eventoPerteneceAHotel(ev, hotel)) return true;
                }
            }
            return false;
        });

        eventosActivos.sort((a, b) => (PRIORITY_RANK[window.normalizeTipo(a.tipo)] || 99) - (PRIORITY_RANK[window.normalizeTipo(b.tipo)] || 99));

        for (const ev of eventosActivos) {
            const tipo = window.normalizeTipo(ev.tipo);
            
            if (isDiagTarget && (tipo === 'INTERCAMBIO_TURNO' || tipo === 'CAMBIO_TURNO')) {
                console.log(`[DEBUG_INTERCAMBIO_EVENTO_RECIBIDO] emp=${empId} fecha=${date}`, {
                    id: ev.id,
                    tipo,
                    estado: ev.estado,
                    solicitante: ev.empleado_id,
                    companero: ev.empleado_destino_id,
                    turno_orig: ev.turno_original || ev.payload?.origen,
                    turno_dest: ev.turno_nuevo || ev.payload?.destino,
                    hotel_orig: ev.hotel_origen,
                    hotel_dest: ev.hotel_destino
                });
            }

            if (['VAC', 'BAJA', 'PERMISO', 'PERM', 'FORMACION', 'FORM'].includes(tipo) && window.isTitularOfAbsence(ev, empId)) {
                result.incidencia = tipo;
                result.turno = null;
                result.origen = tipo;
                result.icon = window.getTurnoIcon(tipo);
                result.icons = [result.icon];
                const sustId = window.normalizeId(window.getEventDestinationRaw(ev));
                if (sustId && sustId !== empId) result.sustituidoPor = sustId;
                break;
            }

            if (['VAC', 'BAJA', 'PERMISO', 'PERM', 'SUSTITUCION', 'COBERTURA'].includes(tipo) && !window.isTitularOfAbsence(ev, empId)) {
                const tId = window.normalizeId(window.getEventOriginRaw(ev));
                result.sustituyeA = tId;
                result.incidenciaCubierta = tipo;
                result.absenceType = tipo;
                result.isCoverageMarker = true;
                result.origen = tipo;
                result.turno = window.getTurnoBaseDeEmpleado(tId, date, baseIndex) || '—';
                const coverShift = window.normalizeShiftValue(result.turno);
                
                // REGLA 📌 V12.8: Solo para Baja o Permiso. NO para Vacaciones.
                const motivoReal = window.normalizeTipo(ev.payload?.incidencia_cubierta || ev.payload?.motivo || tipo);
                const esBajaOPermiso = ['BAJA', 'PERM', 'IT'].includes(motivoReal);
                const esTrabajo = coverShift && coverShift !== 'D' && coverShift !== 'VAC';

                if (esBajaOPermiso && esTrabajo) {
                    result.icon = '\u{1F4CC}';
                    result.icons = [...new Set([...(result.icons || []), '\u{1F4CC}'])];
                }
                continue;
            }

            if (skipChanges && ['INTERCAMBIO_TURNO', 'CAMBIO_TURNO', 'CT'].includes(tipo)) continue;

            if (['INTERCAMBIO_TURNO', 'CAMBIO_TURNO', 'CT'].includes(tipo)) {
                const normEv = window.normalizeCambioEvento(ev);
                if (!normEv) continue;

                const requestedA = normEv.idOrig;
                const requestedB = normEv.idDest;
                const resolvedA = window.getOperationalOccupant(requestedA, date, eventos, hotel, { baseIndex });
                const resolvedB = window.getOperationalOccupant(requestedB, date, eventos, hotel, { baseIndex });
                
                // FIX V13.34: Si la resolución operativa colapsa a la misma persona (ej. titular ausente y sustituto involucrados),
                // priorizamos las identidades solicitadas para que el marcador 🔄 se aplique a ambos correctamente.
                const finalA = (resolvedA === resolvedB && requestedA !== requestedB) ? requestedA : resolvedA;
                const finalB = (resolvedA === resolvedB && requestedA !== requestedB) ? requestedB : resolvedB;

                const strippedEmpId = empId.replace(/^(vacante|placeholder)-?/, '');
                const isOrigin = empId === finalA || strippedEmpId === finalA;
                // Alias: la fila '¿?' actua como 'Proximamente' si ese es el destino del intercambio
                const isPlaceholder = empId === '¿?' || empId === '?';
                const isDestinationByAlias = isPlaceholder && finalB && !['¿?', '?', '', 'null', 'undefined'].includes(finalB);
                const isDestination = empId === finalB || strippedEmpId === finalB || isDestinationByAlias;
                const tOrigRaw = normEv.turnoOrigen;
                const tDestRaw = normEv.turnoDestino;
                const hasValidOriginShift = window.isValidShiftValue(tOrigRaw);
                const hasValidDestinationShift = window.isValidShiftValue(tDestRaw);

                if (isDiagTarget) {
                    console.log(`[ShiftResolver_DEBUG] Intercambio ev=${ev.id} fecha=${date}`, {
                        requestedA, requestedB, resolvedA, resolvedB, finalA, finalB,
                        tOrigRaw, tDestRaw, hasValidOriginShift, hasValidDestinationShift
                    });
                }

                if (tipo === 'INTERCAMBIO_TURNO' && !requestedB) continue;
                if (tipo === 'CAMBIO_TURNO' && !requestedB && !hasValidDestinationShift) continue;

                if (isOrigin || isDestination) {
                    if (tipo === 'CAMBIO_TURNO' && !requestedB) {
                        if (!isOrigin || !hasValidDestinationShift) continue;
                        const currentCode = window.normalizeShiftValue(result.turno);
                        const originalCode = window.normalizeShiftValue(tOrigRaw);
                        if (hasValidOriginShift && currentCode && originalCode !== currentCode) continue;
                        result.turno = tDestRaw;
                        result.cambio = true;
                        result.intercambio = false;
                        result.icon = '\u{1F504}';
                        result.icons = ['\u{1F504}'];
                        result.origen = tipo;
                        continue;
                    }

                    if (!requestedB || !hasValidOriginShift || !hasValidDestinationShift) {
                        if (isDiagTarget) console.warn(`[ShiftResolver] ${tipo} descartado por falta de datos:`, { requestedB, hasValidOriginShift, hasValidDestinationShift });
                        continue;
                    }

                    const isLegacyCT = window.isInvalidLegacyChangeValue(tOrigRaw) || window.isInvalidLegacyChangeValue(tDestRaw);
                    const tOpA = (isOrigin ? result.turno : window.getTurnoOperativoBase(requestedA, date, { baseIndex, eventos, hotel })) || '—';
                    const tOpB = (isDestination ? result.turno : window.getTurnoOperativoBase(requestedB, date, { baseIndex, eventos, hotel })) || '—';
                    
                    const eventOrigCode = window.normalizeShiftValue(tOrigRaw);
                    const eventDestCode = window.normalizeShiftValue(tDestRaw);
                    const baseOrigCode = window.normalizeShiftValue(tOpA);
                    const baseDestCode = window.normalizeShiftValue(tOpB);
                    const hasComparableEvent = Boolean(eventOrigCode && eventDestCode);
                    
                    // Coherence check: If base is empty, we don't treat it as incoherent if the event has a value
                    // REGLA OPERATIVA: Los intercambios con sustitutos mandan sobre el Excel base
                    const isIncoherente = hasComparableEvent && (
                        (baseOrigCode && baseOrigCode !== '—' && eventOrigCode !== baseOrigCode) || 
                        (baseDestCode && baseDestCode !== '—' && eventDestCode !== baseDestCode)
                    );

                    let finalTurnoOrigen = tDestRaw;
                    let finalTurnoDestino = tOrigRaw;

                    if (!window.isValidShiftValue(tOrigRaw) || !window.isValidShiftValue(tDestRaw) || isLegacyCT || isIncoherente) {
                        finalTurnoOrigen = tOpB;
                        finalTurnoDestino = tOpA;
                    }

                    // SONNET_INTERCAMBIO_APLICADO_OCTUBRE log obligatorio
                    if (isDiagTarget && date === '2026-10-21' && (window.normalizePersonKey(normEv.origen) === 'dani' || window.normalizePersonKey(normEv.destino) === 'proximamente')) {
                        console.log('[SONNET_INTERCAMBIO_APLICADO_OCTUBRE]\nfecha=' + date + '\norigen=' + normEv.origen + '\ndestino=' + normEv.destino + '\nDani_antes=' + (isOrigin ? tOpA : (isDestination ? tOpB : 'N/A')) + '\nProximamente_antes=' + (isDestination ? tOpB : (isOrigin ? tOpA : 'N/A')) + '\nDani_despues=' + (isOrigin ? finalTurnoOrigen : 'N/A') + '\nProximamente_despues=' + (isDestination ? finalTurnoDestino : 'N/A'));
                    }
                    // === LOGS DE INTERCAMBIO OBLIGATORIOS ===
                    if (isDiagTarget) {
                        const _empName = isOrigin ? normEv.origen : (isDestination ? normEv.destino : empId);
                        const _turnoAntes = isOrigin ? tOpA : tOpB;
                        const _turnoDespues = isOrigin ? finalTurnoOrigen : finalTurnoDestino;
                        const _role = isOrigin ? 'ORIGEN' : 'DESTINO';
                        console.log('[INTERCAMBIO_BEFORE_TARGET]\nfecha=' + date + '\norigen=' + normEv.origen + '\ndestino=' + normEv.destino + '\norigenKey=' + requestedA + '\ndestinoKey=' + requestedB + '\nturnoOrigenAntes=' + tOpA + '\nturnoDestinoAntes=' + tOpB);
                        if (isOrigin) console.log('[INTERCAMBIO_WRITE_ORIGEN_TARGET]\nempleado=' + normEv.origen + '\nvalorEscrito=' + finalTurnoOrigen + '\nintercambio=true\nmarker=\u{1F504}');
                        if (isDestination) console.log('[INTERCAMBIO_WRITE_DESTINO_TARGET]\nempleado=' + normEv.destino + '\nempId=' + empId + '\nvalorEscrito=' + finalTurnoDestino + '\nintercambio=true\nmarker=\u{1F504}');
                    }

                    result.turno = isOrigin ? finalTurnoOrigen : finalTurnoDestino;
                    result.cambio = true;
                    result.intercambio = true;
                    result.icon = '\u{1F504}';
                    result.icons = [...new Set([...(result.icons || []), '\u{1F504}'])];
                    result.origen = tipo;
                    if (isDiagTarget) { console.log('[INTERCAMBIO_AFTER_TARGET]\\nfecha=' + date + '\\n' + (isOrigin ? normEv.origen : normEv.destino) + '=' + result.turno + ' \u{1F504}\\nempId=' + empId + '\\nrole=' + (isOrigin ? 'ORIGEN' : 'DESTINO')); }
                    if ((window.normalizeDate(date) === '2026-10-21') && (window.normalizePersonKey(normEv.origen) === 'dani' || window.normalizePersonKey(normEv.destino) === 'proximamente')) {
                        const htmlLabel = window.renderTurnoContent ? window.renderTurnoContent(result.turno, result) : String(result.turno || '');
                        if (isOrigin) console.log(`[SONNET_RENDER_FINAL_OCTUBRE] Dani_2026_10_21=${result.turno} 🔄 htmlDani=${htmlLabel}`);
                        if (isDestination) console.log(`[SONNET_RENDER_FINAL_OCTUBRE] Proximamente_2026_10_21=${result.turno} 🔄 htmlProximamente=${htmlLabel}`);
                    }
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
        if (up.startsWith('VAC')) return '🏖️';
        if (up.startsWith('BAJ')) return '🩺';
        if (up.startsWith('PER')) return '🗓️';
        if (up.startsWith('FOR')) return '🎓';
        if (up === 'N' || up === 'NOCHE') return '🌙';
        if (flags.intercambio) return '🔄';
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
