const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const targetFunction = `    const getTurnoEmpleadoExtended = (empleadoId, fecha) => {
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
    };`;

const replacementFunction = `    const baseGetTurnoEmpleado = (empleadoId, fecha) => {
        const normEmpId = window.normalizeId(empleadoId);
        const profile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
        const titularRow = sourceRows.find(r => window.normalizeId(r.empleadoId) === normEmpId);
        const dateIdx = dates.indexOf(fecha);
        const turnoBase = (titularRow && dateIdx !== -1) ? (titularRow.values[dateIdx] || null) : null;
        
        return window.resolveEmployeeDay({
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
        const res = baseGetTurnoEmpleado(empleadoId, fecha);
        return { ...res, _finalState: res };
    };`;

if (content.includes(targetFunction)) {
    content = content.replace(targetFunction, replacementFunction);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Admin.js recursion fixed');
} else {
    console.error('Target function not found exactly');
}
