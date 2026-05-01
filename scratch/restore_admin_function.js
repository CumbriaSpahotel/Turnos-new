const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const startMarker = 'window.createPuestosPreviewModel = ({';
const endMarker = '// --- DIAGNÓSTICO DEL MODELO';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found");
    process.exit(1);
}

const newFunctionContent = `window.createPuestosPreviewModel = ({
    hotel,
    dates = [],
    sourceRows = [],
    rows = [],
    eventos = [],
    employees = []
} = {}) => {
    // 1. INICIALIZACIÓN DE DATOS BASE
    const baseRowsFlat = [];
    const puestosMap = new Map();
    const ausenciaSustitucionMap = new Map(); // normSustitutoId -> [{ titularId, normTitular, fi, ff }]

    // A) Construir baseRows y puestos para el índice
    sourceRows.forEach(sRow => {
        const puestoId = window.buildPuestoId(hotel, sRow.rowIndex);
        if (!puestosMap.has(puestoId)) {
            puestosMap.set(puestoId, {
                puesto_id: puestoId,
                hotel_id: hotel,
                rowIndex: sRow.rowIndex,
                label: \`Puesto \${String((sRow.rowIndex || 0) + 1).padStart(2, '0')}\`,
                excelLabel: String(sRow.displayName || sRow.empleadoId || '').trim(),
                asignaciones: {}
            });
        }
        
        dates.forEach((date, idx) => {
            const turno = sRow.values[idx] || null;
            baseRowsFlat.push({
                empleadoId: sRow.empleadoId,
                fecha: date,
                turno: turno
            });
            puestosMap.get(puestoId).asignaciones[date] = {
                puesto_id: puestoId,
                hotel_id: hotel,
                fecha: date,
                turno_base: turno,
                titular_id: sRow.empleadoId
            };
        });
    });

    // --- IDENTITY REGISTRY (V12.5 Profile-First Normalization) ---
    const idMap = new Map(); // Normalized ID -> Canonical UUID
    const nameToIds = new Map(); // Normalized Name -> Set of Canonical UUIDs
    employees.forEach(e => {
        const canonicalId = e.id;
        const normId = window.normalizeId(e.id);
        const normName = window.normalizeId(e.nombre);
        idMap.set(normId, canonicalId);
        if (!nameToIds.has(normName)) nameToIds.set(normName, new Set());
        nameToIds.get(normName).add(canonicalId);
    });

    const resolveId = (raw) => {
        if (!raw) return null;
        const norm = window.normalizeId(raw);
        if (idMap.has(norm)) return idMap.get(norm);
        const ids = nameToIds.get(norm);
        if (ids && ids.size === 1) return Array.from(ids)[0];
        return raw; 
    };

    const getDisplayName = (id, rowRaw = null) => {
        const canonicalId = resolveId(id);
        const norm = window.normalizeId(canonicalId);
        const profile = employees.find(e => window.normalizeId(e.id) === norm || window.normalizeId(e.nombre) === norm);
        
        return (
            profile?.display_name ||
            profile?.nombre ||
            profile?.name ||
            rowRaw?.displayName ||
            rowRaw?.nombre ||
            (id && !String(id).includes('-') ? id : (rowRaw?.empleadoId || id))
        );
    };

    // B) Construir mapa de sustituciones por ausencia (VAC, BAJA, PERMISO, FORMACION)
    eventos.forEach(ev => {
        const tipo = window.normalizeTipo(ev.tipo);
        if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION'].includes(tipo)) return;
        if (window.normalizeEstado(ev.estado) === 'anulado') return;
        if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

        const sustitutoRaw = ev.empleado_destino_id || ev.sustituto_id ||
            ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto || ev.payload?.sustituto_nombre;
        if (!sustitutoRaw) return;

        const titularRaw = ev.empleado_id;
        if (!titularRaw) return;

        const normSust = window.normalizeId(sustitutoRaw);
        const fi = window.normalizeDate(ev.fecha_inicio);
        const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);

        const normTitularChk = resolveId(titularRaw);
        const titularRowMatch = sourceRows.find(r => resolveId(r.empleadoId) === normTitularChk);
        if (!titularRowMatch) return;

        const titularIdReal = titularRowMatch.empleadoId;
        const normTitularReal = window.normalizeId(titularIdReal);

        if (!ausenciaSustitucionMap.has(normSust)) {
            ausenciaSustitucionMap.set(normSust, []);
        }
        ausenciaSustitucionMap.get(normSust).push({
            titularId: titularIdReal,
            normTitular: normTitularReal,
            sustitutoRaw,
            fi,
            ff
        });
    });

    // 2. CONSTRUIR ÍNDICE GLOBAL (con visibilidad de sustituciones)
    const { baseIndex } = window.buildIndices(employees, eventos, baseRowsFlat);
    baseIndex.ausenciaSustitucionMap = ausenciaSustitucionMap;

    const puestos = Array.from(puestosMap.values()).sort((a, b) => {
        const valA = a.rowIndex === null || a.rowIndex === undefined ? 99999 : a.rowIndex;
        const valB = b.rowIndex === null || b.rowIndex === undefined ? 99999 : b.rowIndex;
        return valA - valB;
    });

    // Re-mapear el puestoOrden visual para que sea correlativo 1..N según el orden final
    puestos.forEach((p, idx) => {
        p.puestoOrden = idx + 1;
    });

    // 3. FUNCIONES DE RESOLUCIÓN

    const getCelda = (puestoId, fecha) => {
        const puesto = puestosMap.get(puestoId);
        if (!puesto) return null;
        const asig = puesto.asignaciones[fecha];
        if (!asig) return null;

        const res = window.resolveEmployeeDay({
            empleado: employees.find(e => window.normalizeId(e.id) === window.normalizeId(asig.titular_id) || window.normalizeId(e.nombre) === window.normalizeId(asig.titular_id)),
            empleadoId: asig.titular_id,
            hotel,
            fecha,
            turnoBase: asig.turno_base,
            eventos,
            baseIndex,
            allEvents: eventos,
            resolveId: resolveId
        });

        return {
            turno: res.turno,
            titular: getDisplayName(asig.titular_id),
            real: getDisplayName(res.empleadoId),
            incidencia: res.incidencia,
            puesto_id: puestoId,
            hotel_id: hotel,
            fecha,
            turno_base: res.turnoBase,
            titular_id: asig.titular_id,
            real_id: res.empleadoId,
            cobertura: !!res.sustitutoId || (res.empleadoId !== asig.titular_id),
            cambio: res.cambio,
            intercambio: res.intercambio,
            _finalState: res
        };
    };

    const getTurnoEmpleadoExtended = (empleadoId, fecha) => {
        const normEmpId = window.normalizeId(empleadoId);
        if (ausenciaSustitucionMap.has(normEmpId)) {
            const coberturas = ausenciaSustitucionMap.get(normEmpId);
            for (const cob of coberturas) {
                if (fecha >= cob.fi && fecha <= cob.ff) {
                    const titularRow = sourceRows.find(r => window.normalizeId(r.empleadoId) === cob.normTitular);
                    const dateIdx = dates.indexOf(fecha);
                    const turnoBase = (titularRow && dateIdx !== -1) ? (titularRow.values[dateIdx] || null) : null;
                    const profile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
                    
                    const res = window.resolveEmployeeDay({
                        empleado: profile || { id: empleadoId, nombre: getDisplayName(empleadoId) },
                        empleadoId,
                        hotel,
                        fecha,
                        turnoBase,
                        eventos,
                        baseIndex,
                        allEvents: eventos,
                        resolveId: resolveId
                    });

                    const shouldKeepResolvedTurno = res.intercambio || res.origen === 'CAMBIO_TURNO' || res.origen === 'INTERCAMBIO_TURNO';
                    const turnoOperativo = shouldKeepResolvedTurno ? res.turno : (turnoBase || res.turno);

                    const finalRes = {
                        ...res,
                        turno: res.incidencia ? res.turno : turnoOperativo,
                        turnoFinal: res.incidencia ? res.turno : turnoOperativo,
                        rol: 'sustituto',
                        sustitucion: true,
                        titular: cob.titularId,
                        _finalState: res
                    };
                    return finalRes;
                }
            }
        }
        const res = getTurnoEmpleado(empleadoId, fecha);
        return { ...res, _finalState: res };
    };

    const getEmployees = (viewType = 'weekly') => {
        const firstDate = dates[0] || '';
        const operationalRows = [];
        const absentRows = [];
        const extraRefuerzoRows = [];
        const assignedNorms = new Set(); // Empleados ya colocados en puestos operativos
        
        // 1. PRE-PROCESAR ESTADO DE LA SEMANA
        const weekStatus = new Map(); // normTitular -> { tipo, sustitutoId, ... }
        const substitutesMap = new Map(); // normSustituto -> { normTitular, ... } (para saber quién cubre a quién)
        
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION'].includes(tipo)) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const tId = ev.empleado_id || ev.titular_id || ev.participante_a || ev.empleado;
            if (!tId) return;
            const normT = resolveId(tId);
            
            let sRaw = window.getOtroEmpleadoDelCambio ? window.getOtroEmpleadoDelCambio(ev, tId) : null;
            if (!sRaw) {
                sRaw = ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto || ev.participante_b || ev.destino_id;
            }
            const normS = resolveId(sRaw);
            
            const existing = weekStatus.get(normT);
            if (existing && existing.sustitutoId && !sRaw) return;

            const statusData = { 
                tipo, 
                sustitutoId: normS, 
                rawSust: sRaw, 
                titularId: tId,
                event_id: ev.id,
                payload: ev.payload,
                meta: ev.meta
            };
            weekStatus.set(normT, statusData);
            if (normS) substitutesMap.set(normS, statusData);
        });

        // 2. PROCESAR FILAS EXCEL (ESTRUCTURA BASE)
        sourceRows.forEach(r => {
            if (String(r.empleadoId || '').includes('---') || String(r.empleadoId || '').includes('___')) return;
            
            const normTitular = resolveId(r.empleadoId);
            const v9Order = window.getV9ExcelOrder(hotel, r.week_start || firstDate, r.empleadoId) || 500;
            const status = weekStatus.get(normTitular);

            // CASO A: TITULAR ESTÁ AUSENTE
            if (status) {
                const titularName = getDisplayName(r.empleadoId, r);
                absentRows.push({
                    ...r,
                    employee_id: r.empleadoId,
                    nombre: titularName,
                    nombreVisible: titularName,
                    isAbsentInformative: true,
                    rowType: 'ausencia_informativa',
                    puestoOrden: v9Order + 1000,
                    evento_id: status.event_id,
                    titularOriginalId: r.empleadoId
                });

                let occupantId = null;
                let isSustitucion = false;
                let isVacante = false;

                if (status.sustitutoId) {
                    occupantId = status.sustitutoId;
                    isSustitucion = true;
                } else {
                    occupantId = 'VACANTE-' + normTitular;
                    isVacante = true;
                }

                const normOcc = resolveId(occupantId);
                if (isSustitucion && assignedNorms.has(normOcc)) {
                    occupantId = 'VACANTE-' + normTitular;
                    isVacante = true;
                    isSustitucion = false;
                }

                const occName = isVacante ? 'VACANTE' : getDisplayName(occupantId, { nombre: status.rawSust });
                operationalRows.push({
                    ...r,
                    employee_id: occupantId,
                    empleadoId: occupantId,
                    nombre: occName,
                    nombreVisible: occName,
                    displayName: occName,
                    isVacante,
                    isSustitucion,
                    puestoOrden: v9Order,
                    rowType: 'operativo',
                    titularOriginal: titularName,
                    titularOriginalId: r.empleadoId,
                    evento_id: status.event_id
                });
                if (occupantId && !isVacante) assignedNorms.add(normOcc);

            } 
            // CASO B: TITULAR ESTÁ PRESENTE
            else {
                const statusInThisHotel = substitutesMap.get(normTitular);
                const isSubbingInThisHotel = statusInThisHotel && window.eventoPerteneceAHotel && window.eventoPerteneceAHotel(statusInThisHotel.payload || statusInThisHotel, hotel);

                if (isSubbingInThisHotel) return; 

                if (!assignedNorms.has(normTitular)) {
                    const titularName = getDisplayName(r.empleadoId, r);
                    operationalRows.push({
                        ...r,
                        employee_id: r.empleadoId,
                        empleadoId: r.empleadoId,
                        nombre: titularName,
                        nombreVisible: titularName,
                        displayName: titularName,
                        puestoOrden: v9Order,
                        rowType: 'operativo',
                        titularOriginal: titularName
                    });
                    assignedNorms.add(normTitular);
                }
            }
        });

        // 3. PROCESAR REFUERZOS EXPLÍCITOS
        eventos.forEach(ev => {
            const isExplicitRef = Boolean(ev.isRefuerzo === true || ev.origen === 'refuerzo' || ev.payload?.tipo_modulo === 'refuerzo' || ev.meta?.refuerzo === true);
            if (!isExplicitRef) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const empId = ev.empleado_id;
            const normEmpId = window.normalizeId(empId);
            if (assignedNorms.has(normEmpId)) return;

            const empName = getDisplayName(empId);
            extraRefuerzoRows.push({ 
                hotel, 
                employee_id: empId, 
                nombre: empName, 
                puestoOrden: 2000, 
                rowType: 'refuerzo',
                origenOrden: 'refuerzo_explicito',
                evento_id: ev.id
            });
            assignedNorms.add(normEmpId);
        });

        operationalRows.sort((a, b) => a.puestoOrden - b.puestoOrden);
        absentRows.sort((a, b) => a.puestoOrden - b.puestoOrden);
        extraRefuerzoRows.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        return [...operationalRows, ...absentRows, ...extraRefuerzoRows];
    };

    return {
        hotel,
        dates,
        puestos,
        getPuesto: (id) => puestosMap.get(id),
        getCelda,
        getTurnoEmpleado: getTurnoEmpleadoExtended,
        getCeldaByEmpleado: getTurnoEmpleadoExtended, // Alias para facilitar publicación
        getEmployees,
        getEmpleadosVisibles: (start, end) => getEmployees(),
        estaDeVacaciones: (empId, fechas) => (fechas || []).some(f => getTurnoEmpleadoExtended(empId, f).incidencia === 'VAC'),
        ordenarEmpleados: (emps) => emps,
        getEmployeeName: (id) => getDisplayName(id)
    };
};\n`;

const result = content.substring(0, startIndex) + newFunctionContent + content.substring(endIndex);
fs.writeFileSync(path, result, 'utf8');
console.log('Admin.js function createPuestosPreviewModel restored and fixed');
