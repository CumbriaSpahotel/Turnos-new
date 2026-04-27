
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// Use markers to identify the function block
const startMarker = '    const getEmployees = () => {';
const endMarker = '        return finalRows;\r\n    };'; // Try with CRLF just in case

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
    console.error("Start marker not found");
    process.exit(1);
}

// Find the end marker after the start marker
let endIndex = content.indexOf('return finalRows;', startIndex);
if (endIndex === -1) {
    console.error("End marker not found");
    process.exit(1);
}
// Find the closing brace of the function
endIndex = content.indexOf('};', endIndex) + 2;

const newFunction = `    const getEmployees = () => {
        const operativeRows = [];
        const handledEmps = new Set();
        const firstDate = dates[0] || '';

        // 1. Identificar sustituciones activas para esta semana (titular -> sustituto)
        const activeSubstitutions = new Map();
        ausenciaSustitucionMap.forEach((coberturas, normSust) => {
            coberturas.forEach(cob => {
                const overlaps = dates.some(d => d >= cob.fi && d <= cob.ff);
                if (overlaps) {
                    activeSubstitutions.set(cob.normTitular, {
                        sustitutoId: normSust,
                        rawSust: cob.sustitutoRaw,
                        titularId: cob.titularId
                    });
                }
            });
        });

        // 2. FASE A: Procesar Filas Base de Excel (Respetando Posición)
        sourceRows.forEach(r => {
            const normTitular = window.normalizeId(r.empleadoId);
            const sub = activeSubstitutions.get(normTitular);
            
            let empIdToUse = r.empleadoId;
            let isSustitucion = false;
            let titularName = r.displayName || r.empleadoId;

            if (sub) {
                // El sustituto ocupa la posición del titular
                empIdToUse = sub.rawSust;
                isSustitucion = true;
            }

            const normEmpId = window.normalizeId(empIdToUse);
            if (handledEmps.has(normEmpId)) return;

            const empProfile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
            const displayName = empProfile?.nombre || empIdToUse;

            operativeRows.push({
                ...r,
                employee_id: empIdToUse,
                empleadoId: empIdToUse,
                nombre: displayName,
                displayName: displayName,
                puestoOrden: r.rowIndex, 
                isSustitucion,
                titularOriginal: titularName,
                _esSustitutoDe: isSustitucion ? titularName : null
            });
            handledEmps.add(normEmpId);
        });

        // 3. FASE B: Añadir Refuerzos y Coberturas Externas que no están en el cuadrante base
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            const isRef = Boolean(
                ev.isRefuerzo === true || 
                ev.origen === 'refuerzo' || 
                tipo === 'REFUERZO' ||
                ev.payload?.tipo_modulo === 'refuerzo'
            );
            if (!isRef) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            
            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            const overlaps = dates.some(d => d >= fi && d <= ff);
            if (!overlaps) return;

            const empId = ev.empleado_id;
            const normEmpId = window.normalizeId(empId);
            if (handledEmps.has(normEmpId)) return;

            const empProfile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
            
            operativeRows.push({
                hotel,
                hotel_id: hotel,
                employee_id: empId,
                empleadoId: empId,
                nombre: empProfile?.nombre || empId,
                displayName: empProfile?.nombre || empId,
                puestoOrden: 9999, 
                isRefuerzo: true,
                puesto: 'Refuerzo'
            });
            handledEmps.add(normEmpId);
        });

        ausenciaSustitucionMap.forEach((coberturas, normSust) => {
            if (handledEmps.has(normSust)) return;
            const hasActive = coberturas.some(cob => dates.some(d => d >= cob.fi && d <= cob.ff));
            if (hasActive) {
                const empProfile = employees.find(e => window.normalizeId(e.id) === normSust || window.normalizeId(e.nombre) === normSust);
                const rawSust = coberturas[0].sustitutoRaw;
                operativeRows.push({
                    hotel,
                    hotel_id: hotel,
                    puesto: 'Apoyo',
                    employee_id: rawSust,
                    empleadoId: rawSust,
                    nombre: empProfile?.nombre || rawSust,
                    displayName: empProfile?.nombre || rawSust,
                    puestoOrden: 10000, 
                    isSustitucion: true
                });
                handledEmps.add(normSust);
            }
        });

        // 4. ORDEN FINAL DETERMINISTA
        operativeRows.sort((a, b) => {
            const v9OrderA = window.getV9ExcelOrder(hotel, firstDate, a.employee_id) ?? window.getV9ExcelOrder(hotel, firstDate, a.titularOriginal);
            const v9OrderB = window.getV9ExcelOrder(hotel, firstDate, b.employee_id) ?? window.getV9ExcelOrder(hotel, firstDate, b.titularOriginal);
            
            if (v9OrderA !== null && v9OrderB !== null) return v9OrderA - v9OrderB;
            if (v9OrderA !== null) return -1;
            if (v9OrderB !== null) return 1;

            if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        
        return operativeRows;
    };`;

const updatedContent = content.substring(0, startIndex) + newFunction + content.substring(endIndex);
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log("admin.js updated successfully");
