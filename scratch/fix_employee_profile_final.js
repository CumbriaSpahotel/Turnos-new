const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Store rawData globally in renderExcelView
const oldFetch = "const rawData = await window.TurnosDB.fetchTurnosBase(wStartStr, wEndStr, selectedHotel);";
const newFetch = "const rawData = await window.TurnosDB.fetchTurnosBase(wStartStr, wEndStr, selectedHotel);\n        window._lastRawTurnosBase = rawData;";

if (content.includes(oldFetch)) {
    content = content.replace(oldFetch, newFetch);
}

// 2. Improve buildEmployeeProfileModel to use _lastRawTurnosBase
const oldBaseLogic = `    const excelSource = window._adminExcelEditableRows || window._adminExcelBaseOriginalRows || null;
    if (excelSource) {`;

const newBaseLogic = `    let excelSource = window._adminExcelEditableRows || window._adminExcelBaseOriginalRows || null;
    let fallbackRaw = window._lastRawTurnosBase || [];
    
    if (!excelSource && fallbackRaw.length > 0) {
        // Build a temporary index from raw data if globals are empty
        const bRows = [];
        fallbackRaw.forEach(r => {
            if (window.normalizeId(r.empleado_id) === window.normalizeId(emp.id)) {
                bRows.push({ empleadoId: r.empleado_id, fecha: r.fecha, turno: r.turno });
            }
        });
        if (bRows.length > 0 && window.buildIndices) {
            const built = window.buildIndices(window.empleadosGlobales || [], [], bRows);
            baseIndex = built.baseIndex;
        }
    }

    if (excelSource) {`;

if (content.includes(oldBaseLogic)) {
    content = content.replace(oldBaseLogic, newBaseLogic);
}

// 3. Update resolveEmployeeDay call in buildEmployeeProfileModel to ensure hotel is passed
const oldResolveCall = `        const res = window.resolveEmployeeDay({ 
            empleado: profile,
            empleadoId: emp.id,
            fecha,
            eventos,
            baseIndex
        });`;

const newResolveCall = `        const res = window.resolveEmployeeDay({ 
            empleado: profile,
            empleadoId: emp.id,
            hotel: emp.hotel,
            fecha,
            eventos,
            baseIndex
        });`;

if (content.includes(oldResolveCall)) {
    content = content.replace(oldResolveCall, newResolveCall);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully applied final fixes to admin.js');
