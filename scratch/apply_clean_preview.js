
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update renderEmpleadoRowHeader
const headerStartIdx = content.indexOf('window.renderEmpleadoRowHeader =');
let headerEndIdx = content.indexOf('};', headerStartIdx) + 2;

const newHeader = `window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {
    // VISTA PREVIA: NO MOSTRAR ID INTERNO [EMP-XXXX] O UUIDs
    if (employee?.isVacante) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:800; color:#ef4444; font-size:0.82rem; line-height:1.3;">⚠️ VACANTE</span>
            <span style="color:#64748b; font-size:0.6rem; font-weight:500;">Sin cubrir (\${escapeHtml(employee.titularOriginal)})</span>
        </div>\`;
    }

    if (employee?.isAbsentInformative) {
        const name = escapeHtml(employee?.nombre || employee?.displayName || 'Empleado');
        const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : '';
        return \`
        <div style="display:flex; flex-direction:column; gap:2px; opacity: 0.7;">
            <span style="font-weight:700; color:#64748b; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}</span>
            <span style="color:#94a3b8; font-size:0.55rem; font-weight:600; text-transform:uppercase;">Ausencia Informativa</span>
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

    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : '';
    const supportBadge = isExplicitRefuerzo ? \`<span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;margin-left:6px;">REFUERZO</span>\` : '';
    
    return \`
    <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#0f172a; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}\${supportBadge}</span>
    </div>\`;
};`;

if (headerStartIdx !== -1) {
    content = content.substring(0, headerStartIdx) + newHeader + content.substring(headerEndIdx);
}

// 2. Update getEmployees
const startMarker = '    const getEmployees = () => {';
const startIndex = content.indexOf(startMarker);
let endIndex = content.indexOf('return operativeRows;', startIndex);
endIndex = content.indexOf('};', endIndex) + 2;

const newGetEmployees = `    const getEmployees = () => {
        const operativeRows = [];
        const absenceInfoRows = [];
        const extraRefuerzoRows = [];
        const handledEmpsOperative = new Set();
        const handledEmpsInformative = new Set();
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
                    // Hay sustituto: El sustituto ocupa la posición operativa
                    empIdToUse = status.rawSust;
                    const sustProfile = employees.find(e => window.normalizeId(e.id) === status.sustitutoId || window.normalizeId(e.nombre) === status.sustitutoId);
                    displayName = sustProfile?.nombre || status.rawSust;
                    isSustitucion = true;
                    
                    // El titular pasa a fila informativa
                    if (!handledEmpsInformative.has(normTitular)) {
                        const titularProfile = employees.find(e => window.normalizeId(e.id) === normTitular || window.normalizeId(e.nombre) === normTitular);
                        absenceInfoRows.push({
                            ...r,
                            employee_id: r.empleadoId,
                            empleadoId: r.empleadoId,
                            nombre: titularProfile?.nombre || r.empleadoId,
                            displayName: titularProfile?.nombre || r.empleadoId,
                            puestoOrden: 99999, // Al final
                            isAbsentInformative: true
                        });
                        handledEmpsInformative.add(normTitular);
                    }
                } else if (status.tipo !== 'REFUERZO') {
                    // Ausencia sin sustituto -> VACANTE
                    isVacante = true;
                    empIdToUse = 'VACANTE-' + normTitular;
                    
                    // El titular pasa a fila informativa
                    if (!handledEmpsInformative.has(normTitular)) {
                        const titularProfile = employees.find(e => window.normalizeId(e.id) === normTitular || window.normalizeId(e.nombre) === normTitular);
                        absenceInfoRows.push({
                            ...r,
                            employee_id: r.empleadoId,
                            empleadoId: r.empleadoId,
                            nombre: titularProfile?.nombre || r.empleadoId,
                            displayName: titularProfile?.nombre || r.empleadoId,
                            puestoOrden: 99999,
                            isAbsentInformative: true
                        });
                        handledEmpsInformative.add(normTitular);
                    }
                }
            }

            const normEmpId = window.normalizeId(empIdToUse);
            if (handledEmpsOperative.has(normEmpId)) return;

            operativeRows.push({
                ...r,
                employee_id: empIdToUse,
                empleadoId: empIdToUse,
                nombre: displayName,
                displayName: displayName,
                puestoOrden: r.rowIndex, 
                isSustitucion,
                isVacante,
                titularOriginal: titularName
            });
            handledEmpsOperative.add(normEmpId);
        });

        // 3. FASE B: Añadir Refuerzos y Coberturas Externas
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
            if (handledEmpsOperative.has(normEmpId)) return;

            const empProfile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
            
            extraRefuerzoRows.push({
                hotel,
                hotel_id: hotel,
                employee_id: empId,
                empleadoId: empId,
                nombre: empProfile?.nombre || empId,
                displayName: empProfile?.nombre || empId,
                puestoOrden: 100000, 
                isRefuerzo: true,
                puesto: 'Refuerzo'
            });
            handledEmpsOperative.add(normEmpId);
        });

        // 4. ORDEN FINAL: OPERATIVOS -> AUSENTES -> REFUERZOS
        const combined = [...operativeRows, ...absenceInfoRows, ...extraRefuerzoRows];
        
        combined.sort((a, b) => {
            // Prioridad por bloque (puestoOrden)
            if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
            
            // Si son del mismo bloque (ej: dos ausentes o dos refuerzos), alfabético
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        
        return combined;
    };`;

if (startIndex !== -1) {
    content = content.substring(0, startIndex) + newGetEmployees + content.substring(endIndex);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated with Clean Preview logic (Operative/Informative rows)");
