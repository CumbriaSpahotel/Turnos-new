
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE renderEmpleadoRowHeader to handle Vacante
const oldHeaderStart = 'window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {';
const oldHeaderEnd = '    return `\r\n    <div style="display:flex; flex-direction:column; gap:2px;">\r\n        <span style="font-weight:700; color:#0f172a; font-size:0.82rem; line-height:1.3;">${name}${vacIcon}${supportBadge}</span>\r\n        ${sustBadge}\r\n    </div>`;\r\n};';

// Let's use a more robust replacement for renderEmpleadoRowHeader
const newHeader = `window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {
    // VISTA PREVIA: NO MOSTRAR ID INTERNO [EMP-XXXX] O UUIDs
    if (employee?.isVacante) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:800; color:#ef4444; font-size:0.82rem; line-height:1.3;">⚠️ VACANTE</span>
            <span style="color:#64748b; font-size:0.6rem; font-weight:500;">Sin cubrir (\${escapeHtml(employee.titularOriginal)})</span>
        </div>\`;
    }

    const name = escapeHtml(employee?.nombre || employee?.displayName || 'Empleado');
    
    // helper isExplicitRefuerzo
    const isExplicitRefuerzo = Boolean(
        employee?.isRefuerzo === true ||
        employee?.origen === 'refuerzo' ||
        employee?.payload?.tipo_modulo === 'refuerzo' ||
        employee?.payload?.creado_desde === 'admin_refuerzo' ||
        employee?.meta?.refuerzo === true
    );

    const isSustituto = Boolean(employee?._esSustitutoDe);
    const titularName = employee?._esSustitutoDe;

    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : '';
    const supportBadge = isExplicitRefuerzo ? \`<span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;margin-left:6px;">REFUERZO</span>\` : '';
    const sustBadge = isSustituto ? \`<span style="display:block;color:#64748b;font-size:0.6rem;font-weight:500;margin-top:2px;">Sustituye a \${escapeHtml(titularName)}</span>\` : '';
    
    return \`
    <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#0f172a; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}\${supportBadge}</span>
        \${sustBadge}
    </div>\`;
};`;

// Find and replace renderEmpleadoRowHeader
// We can use a simpler approach by finding the function start and the next closing brace at column 0 or similar
const headerStartIdx = content.indexOf('window.renderEmpleadoRowHeader =');
let headerEndIdx = content.indexOf('};', headerStartIdx) + 2;
// Check if it's the right closing brace
if (headerStartIdx !== -1) {
    content = content.substring(0, headerStartIdx) + newHeader + content.substring(headerEndIdx);
}

// 2. UPDATE getEmployees to handle Vacante and better resolution
const startMarker = '    const getEmployees = () => {';
const startIndex = content.indexOf(startMarker);
let endIndex = content.indexOf('return operativeRows;', startIndex);
endIndex = content.indexOf('};', endIndex) + 2;

const newGetEmployees = `    const getEmployees = () => {
        const operativeRows = [];
        const handledEmps = new Set();
        const firstDate = dates[0] || '';

        // 1. Identificar todas las ausencias y sustituciones para esta semana
        const weekStatus = new Map(); // normTitular -> { tipo, sustitutoId, rawSust, fi, ff }
        
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION', 'REFUERZO'].includes(tipo)) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            const overlaps = dates.some(d => d >= fi && d <= ff);
            if (!overlaps) return;

            const titularId = ev.empleado_id;
            if (!titularId) return;
            const normTitular = window.normalizeId(titularId);

            const sustitutoRaw = ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto;
            
            // Si ya hay un estado para este titular, priorizar el que tenga sustituto
            const existing = weekStatus.get(normTitular);
            if (existing && existing.sustitutoId && !sustitutoRaw) return;

            weekStatus.set(normTitular, {
                tipo,
                sustitutoId: sustitutoRaw ? window.normalizeId(sustitutoRaw) : null,
                rawSust: sustitutoRaw,
                fi,
                ff,
                titularId
            });
        });

        // 2. FASE A: Procesar Estructura Base del Excel
        sourceRows.forEach(r => {
            const normTitular = window.normalizeId(r.empleadoId);
            const status = weekStatus.get(normTitular);
            
            let empIdToUse = r.empleadoId;
            let displayName = r.displayName || r.empleadoId;
            let isSustitucion = false;
            let isVacante = false;
            let titularName = r.displayName || r.empleadoId;

            if (status) {
                if (status.sustitutoId) {
                    // CASO B / F: Sustitución o Refuerzo con titular cubierto
                    empIdToUse = status.rawSust;
                    const sustProfile = employees.find(e => window.normalizeId(e.id) === status.sustitutoId || window.normalizeId(e.nombre) === status.sustitutoId);
                    displayName = sustProfile?.nombre || status.rawSust;
                    isSustitucion = true;
                } else if (status.tipo !== 'REFUERZO') {
                    // CASO C: Ausencia sin sustituto (VAC, BAJA, PERM) -> VACANTE
                    isVacante = true;
                    empIdToUse = 'VACANTE-' + normTitular;
                }
            }

            const normEmpId = window.normalizeId(empIdToUse);
            if (handledEmps.has(normEmpId)) return;

            operativeRows.push({
                ...r,
                employee_id: empIdToUse,
                empleadoId: empIdToUse,
                nombre: displayName,
                displayName: displayName,
                puestoOrden: r.rowIndex, 
                isSustitucion,
                isVacante,
                titularOriginal: titularName,
                _esSustitutoDe: isSustitucion ? titularName : null
            });
            handledEmps.add(normEmpId);
        });

        // 3. FASE B: Añadir Refuerzos y Coberturas Externas (sin puesto en Fase A)
        // A) Refuerzos sin titular
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            const isRef = Boolean(ev.isRefuerzo === true || ev.origen === 'refuerzo' || tipo === 'REFUERZO' || ev.payload?.tipo_modulo === 'refuerzo');
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

        // B) Sustitutos de ausencias que no se capturaron en Fase A
        weekStatus.forEach((status, normTitular) => {
            if (status.sustitutoId && !handledEmps.has(status.sustitutoId)) {
                const empProfile = employees.find(e => window.normalizeId(e.id) === status.sustitutoId || window.normalizeId(e.nombre) === status.sustitutoId);
                operativeRows.push({
                    hotel,
                    hotel_id: hotel,
                    puesto: 'Apoyo',
                    employee_id: status.rawSust,
                    empleadoId: status.rawSust,
                    nombre: empProfile?.nombre || status.rawSust,
                    displayName: empProfile?.nombre || status.rawSust,
                    puestoOrden: 10000, 
                    isSustitucion: true,
                    _esSustitutoDe: status.titularId
                });
                handledEmps.add(status.sustitutoId);
            }
        });

        // 4. ORDEN FINAL POR PUESTO
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

if (startIndex !== -1) {
    content = content.substring(0, startIndex) + newGetEmployees + content.substring(endIndex);
}

// 3. Add Diagnostic Helper
const diagnosticHelper = `
window.diagnoseOperationalOrder = (hotel, weekStart) => {
    const model = Object.values(window._previewPuestosModels || {}).find(m => m.hotel === hotel);
    if (!model) {
        console.warn("[DIAGNOSTIC] No hay modelo activo para", hotel);
        return;
    }

    const firstDate = model.dates[0] || weekStart;
    const baseRows = model.puestos.map(p => ({
        puestoOrden: p.rowIndex,
        titularBase: p.excelLabel,
        origenOrden: 'V9 Excel Map'
    }));

    const operationalRows = model.getEmployees().map(emp => ({
        puestoOrden: emp.puestoOrden,
        ocupanteVisible: emp.nombre,
        titularBase: emp.titularOriginal || emp.nombre,
        motivo: emp.isVacante ? 'Vacante' : (emp.isSustitucion ? 'Sustitucion' : (emp.isRefuerzo ? 'Refuerzo' : 'Titular Base')),
        origenOrden: 'Operativo Herencia'
    }));

    console.group('[DIAGNOSTICO OPERATIVO: ' + hotel + ' ' + firstDate + ']');
    console.log('--- baseRows ---');
    console.table(baseRows);
    console.log('--- operationalRows ---');
    console.table(operationalRows);
    console.groupEnd();
};
`;
content += diagnosticHelper;

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated with Vacante logic and Diagnosis helper");
