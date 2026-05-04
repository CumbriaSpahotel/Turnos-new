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

    window.getEmployeeStructuralType = (emp) => {
        if (!emp) return 'fijo';

        const idNorm = window.normalizeId(emp.id || emp.nombre || '');
        if (!idNorm || idNorm.includes('vacante') || idNorm.includes('placeholder') || emp.isVacante === true || emp.placeholder === true) return 'placeholder';
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

    /**
     * Detecta si un empleado pertenece al tipo estructural apoyo/ocasional.
     * No incluye refuerzo ni sustituto, porque ambos son roles operativos temporales.
     */
    window.isEmpleadoOcasionalOApoyo = (emp) => {
        if (!emp) return false;
        if (emp.excludeCounters) return true;
        const structuralType = window.getEmployeeStructuralType(emp);
        return structuralType === 'apoyo' || structuralType === 'ocasional';
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
        
        if (v.startsWith('VAC')) return 'VAC'; // VAC, VACACIONES, VAC_ðŸ–ï¸ quitado el emoji
        if (['BAJA', 'BAJA_MEDICA', 'BM', 'IT', 'INCAPACIDAD'].includes(v)) return 'BAJA';
        if (v.startsWith('PERM')) return 'PERM'; // unify PERMISO â†’ PERM
        
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
        // Estados de anulación explícita
        if (['anulado', 'anulada', 'rechazado', 'rechazada', 'cancelado', 'cancelada'].includes(v)) return 'anulado';
        // Estados de validez operativa (incluimos FINALIZADO y OK según Regla Maestro v12.5)
        if (['finalizado', 'finalizada', 'completado', 'completada', 'ok', 'aprobado', 'aprobada', 'activo'].includes(v)) return 'activo';
        // Fallback: por seguridad, cualquier otro estado no nulo ni anulado se considera activo para no perder datos en la previsualización
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
        if (!eventHotel) return true; // Si el evento no especifica hotel, permitimos que aplique (permissivo)
        
        const rowHotel = window.normalizeId(hotel);
        const matches = !!rowHotel && eventHotel === rowHotel;
        if (!matches && window.DEBUG_MODE === true) {
            console.warn('[MATCH HOTEL DESCARTADO]', {
                eventoHotel: eventHotel,
                filaHotel: rowHotel || '(sin hotel)',
                evento
            });
        }
        return matches;
    };

    window.isTitularOfAbsence = (evento, empleadoId, context = {}) => {
        const target = window.normalizeId(empleadoId);
        if (!target) return false;

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

        // Si hay una lista de resolución de IDs (aliases), normalizamos el target
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
        const candidatosDestino = [
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
        
        const candidatosA = [
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

        const candidatosB = [
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

        // 4. Fallback por nombre aproximado (seguro: una parte contiene la otra, sin ambigÃ¼edad)
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
                // Solo un candidato: aplicar fallback inequivoco.
                const fallback = tryGet(candidatos[0]);
                if (fallback !== null) return fallback;
            } else if (candidatos.length > 1 && window.DEBUG_MODE === true) {
                console.warn('[BASE ALIAS AMBIGUO]', { empleadoId: normId, fecha: date, candidatos });
            }
        }

        return null;
    };

    // --- 1. MOTOR DE RESOLUCIÓN GENERAL (V12.5.21) ---
    // NO añadir parches por fecha o empleado aquí.
    
    window.getTurnoOperativoBase = (empleadoId, fecha, context = {}) => {
        const baseIndex = context.baseIndex || context;
        const events = context.eventos || [];
        const empIdNorm = window.normalizeId(empleadoId);

        // 1. Ver si está sustituyendo a alguien en los eventos de hoy
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

        // 2. Fallback al base propio
        const turno = window.getTurnoBaseDeEmpleado(empleadoId, fecha, baseIndex);
        return turno === null || turno === undefined || String(turno).trim() === '' ? null : turno;
    };

    /**
     * getOperationalOccupant(empId, date, events, hotel, context)
     * Resuelve quién es el ocupante real de un puesto en una fecha dada.
     * Sigue la cadena de sustituciones si existe.
     */
    window.getOperationalOccupant = (empId, date, events, hotel, context = {}) => {
        const normId = window.normalizeId(empId);
        if (!normId) return null;

        // 1. Prioridad: Mapas pre-construidos (Regla Maestra V140)
        const maps = context.baseIndex || context;
        if (maps.operationalOccupantByOriginalEmployeeId) {
            const dayMap = maps.operationalOccupantByOriginalEmployeeId.get(date);
            if (dayMap && dayMap.has(normId)) {
                const sustId = dayMap.get(normId);
                // Recursión para cadenas de sustitución
                return window.getOperationalOccupant(sustId, date, events, hotel, context);
            }
            return normId;
        }

        // 2. Fallback: Búsqueda dinámica en eventos
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

    window.isValidShiftValue = (value) => {
        const t = String(value || "").trim().toUpperCase();
        return ["M", "T", "N", "D", "MAÑANA", "MANANA", "TARDE", "NOCHE", "DESCANSO"].includes(t);
    };

    window.isInvalidLegacyChangeValue = (value) => {
        const t = String(value || "").trim().toUpperCase();
        return ["CT", "CAMBIO", "CAMBIO_TURNO", "INTERCAMBIO", "INTERCAMBIO_TURNO"].includes(t);
    };

    window.normalizeShiftValue = (value) => {
        if (window.TurnosRules && window.TurnosRules.isEmptyShift && window.TurnosRules.isEmptyShift(value)) return null;
        const t = String(value || "").trim().toUpperCase();
        if (!t || t === '-' || t === '—') return null;
        if (t === "M" || t === "MAÑANA" || t === "MANANA") return "M";
        if (t === "T" || t === "TARDE") return "T";
        if (t === "N" || t === "NOCHE") return "N";
        if (t === "D" || t === "DESCANSO") return "D";
        return null;
    };

    // --- 3. RESOLVE EMPLOYEE DAY ---

    window.resolveEmployeeDay = ({
        empleado,
        empleadoId,
        hotel,
        fecha,
        turnoBase,
        eventos = [],
        baseIndex = null,
        allEvents = [], // V12.5: Contexto global para detectar estados de otros empleados (ej. titular de permiso)
        resolveId // V12.5: Helper de identidad opcional
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
            incidenciaCubierta: null,
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

        const isDiagTarget = false; // V12.5.21: Desactivado debug por empleado específico

        // V12.5: Detección proactiva de Conflictos Multi-Hotel (Natalio Case)
        if (allEvents && allEvents.length > 0) {
            const crossHotelEvents = allEvents.filter(ev => {
                if (window.normalizeEstado(ev.estado) === 'anulado') return false;
                const evHotel = window.normalizeId(ev.hotel_id || ev.hotel);
                const targetHotel = window.normalizeId(hotel);
                if (!evHotel || !targetHotel || evHotel === targetHotel) return false;
                
                const evTitularId = resolveId ? resolveId(ev.empleado_id || ev.titular_id || ev.participante_a) : window.normalizeId(ev.empleado_id || ev.titular_id || ev.participante_a);
                const evSustitutoId = resolveId ? resolveId(ev.empleado_destino_id || ev.sustituto_id || ev.participante_b) : window.normalizeId(ev.empleado_destino_id || ev.sustituto_id || ev.participante_b);
                
                return evTitularId === empId || evSustitutoId === empId;
            });
            if (crossHotelEvents.length > 0) {
                result.conflicto = true;
                result.multiHotel = true;
                result.errores.push(`Conflicto multi-hotel: El empleado ya tiene actividad en otro hotel este día.`);
            }
        }

        // 1. Identificar si el empleado es sustituto operativo de alguien hoy (V140)
        const titularsSubstitutedByMe = [];
        eventos.forEach(ev => {
            const t = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERMISO', 'PERM', 'FORMACION', 'IT', 'SUSTITUCION', 'COBERTURA'].includes(t)) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (!window.eventoAplicaEnFecha(ev, date)) return;
            
            const destId = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto || ev.participante_b);
            if (destId === empId) {
                const titularId = window.normalizeId(ev.empleado_id || ev.titular_id || ev.titular || ev.participante_a || ev.nombre || ev.empleado);
                if (titularId && titularId !== empId) titularsSubstitutedByMe.push(titularId);
            }
        });

        // 2. Buscar eventos aplicables (V140: expandido a titulares que sustituyo)
        let eventosActivos = eventos.filter(ev => {
            const estado = (ev.estado || 'activo').toLowerCase();
            if (estado === 'anulado' || estado === 'rechazado' || estado === 'borrador') return false;
            
            if (!window.eventoAplicaEnFecha(ev, date)) return false;
            if (normHotel && !window.eventoPerteneceAHotel(ev, hotel)) return false;

            // Match directo conmigo
            if (window.eventoPerteneceAEmpleado(ev, empId, { hotel })) return true;
            
            // Match con alguien a quien sustituyo (solo para cambios/intercambios)
            const tipo = window.normalizeTipo(ev.tipo);
            if (tipo === 'INTERCAMBIO_TURNO' || tipo === 'CAMBIO_TURNO') {
                return titularsSubstitutedByMe.some(tId => window.eventoPerteneceAEmpleado(ev, tId, { hotel }));
            }
            
            return false;
        });

        // 1.1 DEDUPLICACIÓN LÓGICA (V12.5.19)
        // Si existen INTERCAMBIO_TURNO y CAMBIO_TURNO para los mismos participantes y fecha, priorizar el primero.
        if (eventosActivos.length > 1) {
            const seen = new Map();
            const filtered = [];
            
            // Primero identificamos intercambios
            const intercambios = eventosActivos.filter(ev => window.normalizeTipo(ev.tipo) === 'INTERCAMBIO_TURNO');
            
            eventosActivos.forEach(ev => {
                const tipo = window.normalizeTipo(ev.tipo);
                if (tipo === 'CAMBIO_TURNO' || tipo === 'CAMBIO') {
                    const otroId = window.getOtroEmpleadoDelCambio(ev, empId);
                    const duplicado = intercambios.find(inc => {
                        const incOtro = window.getOtroEmpleadoDelCambio(inc, empId);
                        return incOtro === otroId;
                    });
                    
                    if (duplicado) {
                        console.warn('[DUPLICATE_CHANGE_SKIPPED]', {
                            fecha: date,
                            hotel: hotel,
                            participantes: `${empId} <-> ${otroId}`,
                            eventoPrincipal: duplicado.id,
                            eventoIgnorado: ev.id,
                            motivo: "duplicado CAMBIO vs INTERCAMBIO"
                        });
                        return; // Ignorar este evento
                    }
                }
                filtered.push(ev);
            });
            eventosActivos = filtered;
        }

        if (eventosActivos.length > 0) {
            // Ordenar por prioridad (1=Máxima, 8=Mínima)
            eventosActivos.sort((a, b) => {
                const pA = PRIORITY_RANK[window.normalizeTipo(a.tipo)] || 99;
                const pB = PRIORITY_RANK[window.normalizeTipo(b.tipo)] || 99;
                return pA - pB;
            });

            for (const ev of eventosActivos) {
                const tipo = window.normalizeTipo(ev.tipo);
                const estado = (ev.estado || 'activo').toLowerCase();
                const isApproved = estado === 'activo' || estado === 'aprobado';
                if (!isApproved) continue;

                const isActuallyIncidenceForMe = ['BAJA', 'VAC', 'PERMISO', 'PERM', 'FORMACION', 'FORM', 'IT'].includes(tipo) && 
                    window.isTitularOfAbsence(ev, empId, { resolveId });

                if (isActuallyIncidenceForMe) {
                    // SOY EL TITULAR DE UNA AUSENCIA (Final de resolución para el titular)
                    result.incidencia = (tipo === 'PERM' ? 'PERMISO' : (tipo === 'FORM' ? 'FORMACION' : tipo));
                    result.turno = null;
                    result.cambio = false; 
                    result.origen = tipo;
                    const otroId = window.getOtroEmpleadoDelCambio(ev, empId);
                    if (otroId) result.sustituidoPor = otroId;
                    break; // Las ausencias del titular son terminales
                } 


                // CASO: SOY EL SUSTITUTO DE UNA AUSENCIA (VAC, BAJA, PERMISO, etc.)
                const isAbsence = ['BAJA', 'PERMISO', 'PERM', 'FORMACION', 'FORM', 'IT', 'VAC'].includes(tipo);
                const titularId = window.normalizeId(ev.empleado_id || ev.titular_id || ev.titular || ev.participante_a || ev.nombre || ev.empleado);
                const destinationId = window.normalizeId(
                    ev.empleado_destino_id ||
                    ev.sustituto_id ||
                    ev.destino_id ||
                    ev.participante_b ||
                    ev.payload?.empleado_destino_id ||
                    ev.payload?.sustituto_id ||
                    ev.payload?.sustituto ||
                    ev.sustituto
                );
                const isSubstitute = isAbsence && destinationId && (window.normalizeId(empId) === destinationId);

                if (isSubstitute || tipo === 'COBERTURA' || tipo === 'SUSTITUCION') {
                    const finalTitularId = isSubstitute ? titularId : window.normalizeId(ev.empleado_id || ev.titular_id || ev.titular || ev.participante_a || ev.nombre || ev.empleado);
                    result.sustituyeA = finalTitularId;
                    result.incidenciaCubierta = tipo; // Guardamos el tipo original (VAC, PERMISO, etc)
                    const titularTurnoBase = window.getTurnoBaseDeEmpleado(finalTitularId, date, baseIndex);
                    result.turno = titularTurnoBase || result.turno || '—';
                    result.turnoBase = titularTurnoBase || result.turnoBase || '—';
                    result.origen = `SUSTITUCION_${tipo}`; // Origen específico: SUSTITUCION_VAC, SUSTITUCION_PERMISO, etc.

                    // Marcador ðŸ“Œ solo para ausencias médicas/permisos (NO para vacaciones ni formación)
                    // REGLA V12.5.40: Solo si el turno resultante es de trabajo (M, T, N)
                    if (['BAJA', 'PERMISO', 'PERM', 'IT'].includes(tipo)) {
                        const shiftKey = window.TurnosRules?.shiftKey ? window.TurnosRules.shiftKey(result.turno) : String(result.turno || '').toLowerCase();
                        if (['m', 't', 'n'].includes(shiftKey)) {
                            result.icon = '\u{1F4CC}';
                            result.icons = ['\u{1F4CC}'];
                            result.isCoverageMarker = true;
                        }
                    }

                    if (isDiagTarget) {
                        console.log('[VAC_SHADOW_FIX_DEBUG] Ocupación operativa definida', {
                            fecha: date,
                            empleado: empId,
                            tipoEvento: tipo,
                            titular: finalTitularId,
                            turnoInherited: result.turno
                        });
                    }
                    // NO hacemos break. Continuamos por si hay un cambio aprobado que aplique sobre este turno.
                    continue;
                }

                    // CASO: CAMBIO / INTERCAMBIO APROBADO
                    if (tipo === 'INTERCAMBIO_TURNO' || tipo === 'CAMBIO_TURNO') {
                        const requestedA = window.normalizeId(ev.empleado_id || ev.titular_id || ev.origen_id || ev.participante_a);
                        const requestedB = window.normalizeId(ev.empleado_destino_id || ev.destino_id || ev.sustituto_id || ev.participante_b);
                        
                        // RESOLUCIÓN OPERATIVA (Regla Maestra V140)
                        // Los cambios se aplican sobre el ocupante real del día.
                        const scanList = (allEvents && allEvents.length > 0) ? allEvents : eventos;
                        const resolvedA = window.getOperationalOccupant ? window.getOperationalOccupant(requestedA, date, scanList, hotel, { baseIndex, eventos }) : requestedA;
                        const resolvedB = window.getOperationalOccupant ? window.getOperationalOccupant(requestedB, date, scanList, hotel, { baseIndex, eventos }) : requestedB;

                        const isOrigin = empId === resolvedA;
                        const isDestination = empId === resolvedB;

                        if (resolvedA !== requestedA || resolvedB !== requestedB) {
                            if (isOrigin || isDestination) {
                                console.log('CHANGE_TARGET_RESOLVED_TO_OPERATIONAL_OCCUPANT:', {
                                    originalTarget: isOrigin ? (requestedA !== resolvedA ? requestedA : '?') : (requestedB !== resolvedB ? requestedB : '?'),
                                    resolvedTarget: empId,
                                    reason: "original target absent with operational substitute",
                                    absenceType: result.incidenciaCubierta || "ABSENCE",
                                    weekStart: window.getWeekStartISO ? window.getWeekStartISO(date) : date,
                                    hotel: hotel,
                                    appliedBetween: `${requestedA} <-> ${requestedB} resolved to ${resolvedA} <-> ${resolvedB}`
                                });
                            }
                        }

                        if (!isOrigin && !isDestination) continue;

                        let tOrigRaw = ev.turno_original || ev.turno_origen;
                        let tDestRaw = ev.turno_nuevo || ev.turno_destino;
                        
                        const isLegacyCT = window.isInvalidLegacyChangeValue(tOrigRaw) || window.isInvalidLegacyChangeValue(tDestRaw);

                        if (isLegacyCT) {
                            console.warn('[LEGACY_CT_BLOCKED]', {
                                cambioId: ev.id,
                                fecha: date,
                                hotel: hotel,
                                origen: requestedA,
                                destino: requestedB,
                                campo: window.isInvalidLegacyChangeValue(tOrigRaw) ? "turno_original" : "turno_nuevo",
                                valor: "CT",
                                accion: "no usado como turno"
                            });
                        }

                        // Obtener turnos base/operativos antes del cambio para reconstrucción
                        // Usamos result.turno (que ya incluye sustituciones previas si las hay) como base operativa para el actual
                        const turnoOperativoOrigenAntes = (isOrigin ? result.turno : window.getTurnoOperativoBase(requestedA, date, { baseIndex, eventos })) || '—';
                        const turnoOperativoDestinoAntes = (isDestination ? result.turno : window.getTurnoOperativoBase(requestedB, date, { baseIndex, eventos })) || '—';

                        const isReciproco = Boolean(requestedA && requestedB);
                        if (isReciproco) {
                            // RECONSTRUCCIÓN DE INTERCAMBIO (REGLA GENERAL V12.5.21)
                            let finalTurnoOrigen = tDestRaw; 
                            let finalTurnoDestino = tOrigRaw;

                            // Comparar códigos normalizados: "Mañana" y "M" son el mismo turno.
                            const eventOrigCode = window.normalizeShiftValue(tOrigRaw);
                            const eventDestCode = window.normalizeShiftValue(tDestRaw);
                            const baseOrigCode = window.normalizeShiftValue(turnoOperativoOrigenAntes);
                            const baseDestCode = window.normalizeShiftValue(turnoOperativoDestinoAntes);
                            const hasComparableEvent = Boolean(eventOrigCode && eventDestCode);
                            const isIncoherente = hasComparableEvent && (
                                (baseOrigCode && eventOrigCode !== baseOrigCode) ||
                                (baseDestCode && eventDestCode !== baseDestCode)
                            );

                            // Reconstruimos si: es legacy CT, campos vacíos, o campos incoherentes con el estado operativo actual
                            if (!window.isValidShiftValue(tOrigRaw) || !window.isValidShiftValue(tDestRaw) || isLegacyCT || isIncoherente) {
                                finalTurnoOrigen = turnoOperativoDestinoAntes;
                                finalTurnoDestino = turnoOperativoOrigenAntes;
                                
                                if (window.DEBUG_MODE || isIncoherente) {
                                    console.log(`[RECONSTRUCT_SWAP_${isIncoherente ? 'INCOHERENT' : 'LEGACY'}]`, {
                                        fecha: date,
                                        origen: requestedA,
                                        destino: requestedB,
                                        baseOrig: turnoOperativoOrigenAntes,
                                        baseDest: turnoOperativoDestinoAntes,
                                        eventOrig: tOrigRaw,
                                        eventDest: tDestRaw,
                                        finalOrig: finalTurnoOrigen,
                                        finalDest: finalTurnoDestino
                                    });
                                }
                                if (isIncoherente && typeof window.reportOperationalDiagnostic === 'function') {
                                    window.reportOperationalDiagnostic({
                                        source: 'shift-resolver',
                                        severity: 'warning',
                                        type: 'RECONSTRUCT_SWAP_INCOHERENT',
                                        title: 'Intercambio reconstruido por incoherencia',
                                        desc: `${requestedA} â†” ${requestedB} el ${date}: el evento no coincide con la base (${eventOrigCode || tOrigRaw || 'sin origen'} / ${eventDestCode || tDestRaw || 'sin destino'} frente a ${baseOrigCode || turnoOperativoOrigenAntes} / ${baseDestCode || turnoOperativoDestinoAntes}).`,
                                        empId: requestedA,
                                        fecha: date,
                                        section: 'preview',
                                        actionLabel: 'Ver en Vista Previa',
                                        key: `shift-resolver|${date}|${requestedA}|${requestedB}`
                                    });
                                }
                            }

                            result.turno = isOrigin ? finalTurnoOrigen : finalTurnoDestino;
                        } else {
                            // UNILATERAL
                            result.turno = window.isValidShiftValue(tDestRaw) ? tDestRaw : (window.isValidShiftValue(tOrigRaw) ? tOrigRaw : result.turno);
                        }

                        // Bloqueo final de "CT" si se coló en el resultado
                        if (window.isInvalidLegacyChangeValue(result.turno)) {
                            result.turno = result.turnoBase || '—';
                            console.warn('[RENDER_GUARD_DEBUG] Bloqueado CT en resultado final de resolución', { fecha: date, empleado: empId });
                        }

                        result.cambio = true;
                        result.intercambio = isReciproco;
                        result.icon = '\u{1F504}';
                        result.icons = ['\u{1F504}'];
                        result.origen = tipo;

                        if (isDiagTarget) {
                            console.log('[DIAG_FINAL_SWAP_RESULT]', {
                                fecha: date,
                                empleado: empId,
                                turnoFinal: result.turno,
                                esOrigen: isOrigin,
                                esDestino: isDestination,
                                turnoReconstruido: isLegacyCT
                            });
                        }
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
        result.coveredType = result.incidenciaCubierta;
        
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

        // --- 5. POST-PROCESAMIENTO Y LIMPIEZA FINAL (V12.5.21) ---
        
        // BLOQUEO ABSOLUTO DE 'CT' COMO TURNO
        if (result.turno === 'CT' || window.isInvalidLegacyChangeValue(result.turno)) {
            result.turno = result.turnoBase || '—';
            result.isModified = false;
        }

        // Limpieza de incidencias si es turno operativo real
        if (result.turno && result.turno !== '—' && result.turno !== 'D') {
            result.isAbsence = false;
        }

        return result;
    };

    // --- 4. ÃNDICES CENTRALES ---

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

    window.runTurnosRegressionTests = () => {
        console.warn("[ShiftResolver] Tests movidos a shift-resolver-tests.js");
        return [];
    };

    window.ShiftResolver = {
        resolveEmployeeDay: window.resolveEmployeeDay,
        buildIndices: window.buildIndices,
        clearCache: () => _cache.clear(),
        runTests: window.runTurnosRegressionTests
    };

    window.resolverTurnoFinal = window.resolveEmployeeDay; // Alias para compatibilidad inmediata

    console.log("[ShiftResolver] Carga finalizada v5.0.");

    // â”€â”€ HELPERS DE PRESENTACION: texto limpio e iconos decorativos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * cleanTurnoLabel(value)
     * Devuelve el texto canonico limpio del turno/incidencia.
     * Elimina emojis, bytes corruptos y normaliza codigos a nombres completos.
     * El valor devuelto es SOLO texto — nunca incluye iconos.
     *
     * @param {string} value - Codigo o nombre crudo (ej. 'M', 'VAC', 'Vacaciones', 'Baja ðŸ¤’')
     * @returns {string} Texto limpio ('Manana', 'Vacaciones', 'Baja', etc.)
     */
    window.cleanTurnoLabel = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        let s = String(value).trim();
        s = s
            .replaceAll('—', '—')
            .replaceAll('–', '—')
            .replaceAll('â€"', '—')
            .replaceAll('Ã—', '—')
            .replaceAll('Mañana', 'Mañana')
            .replaceAll('Formación', 'Formación')
            .replaceAll('Permiso', 'Permiso');
        const up = s.toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '');
        const MAP = {
            'M': 'Mañana', 'MANANA': 'Mañana',
            'T': 'Tarde', 'TARDE': 'Tarde',
            'N': 'Noche', 'NOCHE': 'Noche',
            'D': 'Descanso', 'DESCANSO': 'Descanso',
            'VAC': 'Vacaciones', 'VACACION': 'Vacaciones', 'VACACIONES': 'Vacaciones',
            'BAJA': 'Baja', 'BAJAMEDICA': 'Baja', 'BM': 'Baja',
            'PERM': 'Permiso', 'PERMISO': 'Permiso', 'PERMISOS': 'Permiso',
            'FORM': 'Formación', 'FORMACION': 'Formación',
            '-': '—', '': '—', '—': '—'
        };
        if (MAP[up] !== undefined) return MAP[up];
        if (up.startsWith('VAC')) return 'Vacaciones';
        if (up.startsWith('BAJ')) return 'Baja';
        if (up.startsWith('PER')) return 'Permiso';
        if (up.startsWith('FOR')) return 'Formación';
        if (up === 'SIN_TURNO' || up === 'SINTURNO') return '—';
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
        if (up.startsWith('VAC'))                return '\uD83C\uDFD6\uFE0F'; // ðŸ–ï¸
        if (up === 'BAJA' || up.startsWith('BAJ')) return '\uD83E\uDD12';       // ðŸ¤’
        if (up.startsWith('PER'))                return '\uD83D\uDDD3\uFE0F'; // ðŸ—“ï¸
        if (up.startsWith('FOR'))                return '\uD83C\uDF93';         // ðŸŽ“
        if (up === 'N' || up === 'NOCHE')        return '\uD83C\uDF19';
        // El icono de intercambio SOLO para CT real, no para sustitución por ausencia
        if (flags.intercambio) return '\uD83D\uDD03'; // ðŸ”ƒ
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
