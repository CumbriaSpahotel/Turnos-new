
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE getEmployees
const getEmpsStartMarker = '    const getEmployees = () => {';
const getEmpsStartIndex = content.indexOf(getEmpsStartMarker);
const getEmpsEndIndex = content.indexOf('};', content.indexOf('return ', getEmpsStartIndex)) + 2;

const newGetEmployees = `    const getEmployees = () => {
        const firstDate = dates[0] || '';
        const operativeRows = [];
        const absentRows = [];
        const handledEmpsAsActive = new Set();
        
        // A. Pre-procesar estados de la semana
        const weekStatus = new Map(); // normTitular -> { tipo, sustitutoId, rawSust, titularId }
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION', 'REFUERZO'].includes(tipo)) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const tId = ev.empleado_id;
            if (!tId) return;
            const normT = window.normalizeId(tId);
            const sRaw = ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto;
            
            const existing = weekStatus.get(normT);
            if (existing && existing.sustitutoId && !sRaw) return;

            weekStatus.set(normT, { 
                tipo, 
                sustitutoId: sRaw ? window.normalizeId(sRaw) : null, 
                rawSust: sRaw, 
                titularId: tId 
            });
        });

        // B. Mapa de "Quién ocupa qué puesto base"
        const puestoAssignments = new Map();
        sourceRows.forEach(r => {
            const normT = window.normalizeId(r.empleadoId);
            const status = weekStatus.get(normT);
            
            if (status) {
                if (status.sustitutoId) {
                    puestoAssignments.set(normT, { occupantId: status.rawSust, isSustitucion: true });
                } else if (status.tipo !== 'REFUERZO') {
                    puestoAssignments.set(normT, { occupantId: 'VACANTE-' + normT, isVacante: true });
                } else {
                    puestoAssignments.set(normT, { occupantId: r.empleadoId });
                }
            } else {
                puestoAssignments.set(normT, { occupantId: r.empleadoId });
            }
        });

        // C. Construcción de filas activas (respetando orden Excel)
        sourceRows.forEach(r => {
            const normT = window.normalizeId(r.empleadoId);
            const assignment = puestoAssignments.get(normT);
            if (!assignment) return;

            const v9Order = window.getV9ExcelOrder(hotel, firstDate, r.empleadoId);
            
            // Si el titular está ausente, va a la lista de ausentes informativa al final
            const status = weekStatus.get(normT);
            if (status && status.tipo !== 'REFUERZO') {
                const tProfile = employees.find(e => window.normalizeId(e.id) === normT || window.normalizeId(e.nombre) === normT);
                absentRows.push({
                    ...r,
                    employee_id: r.empleadoId,
                    nombre: tProfile?.nombre || r.empleadoId,
                    isAbsentInformative: true,
                    puestoOrden: v9Order + 100000 
                });
            }

            // El ocupante va a la fila operativa
            const occId = assignment.occupantId;
            const normOcc = window.normalizeId(occId);
            if (handledEmpsAsActive.has(normOcc)) return;

            const occProfile = employees.find(e => window.normalizeId(e.id) === normOcc || window.normalizeId(e.nombre) === normOcc);
            operativeRows.push({
                ...r,
                employee_id: occId,
                empleadoId: occId,
                nombre: occProfile?.nombre || occId,
                displayName: occProfile?.nombre || occId,
                isVacante: assignment.isVacante,
                isSustitucion: assignment.isSustitucion,
                puestoOrden: v9Order,
                titularOriginal: r.displayName || r.empleadoId
            });
            handledEmpsAsActive.add(normOcc);
        });

        // D. Refuerzos explícitos
        eventos.forEach(ev => {
            const isExplicitRef = Boolean(ev.isRefuerzo === true || ev.origen === 'refuerzo' || ev.payload?.tipo_modulo === 'refuerzo');
            if (!isExplicitRef) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const empId = ev.empleado_id;
            const normEmpId = window.normalizeId(empId);
            if (handledEmpsAsActive.has(normEmpId)) return;

            const empProfile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
            operativeRows.push({
                hotel,
                employee_id: empId,
                nombre: empProfile?.nombre || empId,
                puestoOrden: 200000,
                isRefuerzo: true
            });
            handledEmpsAsActive.add(normEmpId);
        });

        const result = [...operativeRows, ...absentRows];
        result.sort((a, b) => {
            if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        
        return result;
    };`;

if (getEmpsStartIndex !== -1) {
    content = content.substring(0, getEmpsStartIndex) + newGetEmployees + content.substring(getEmpsEndIndex);
}

// 2. UPDATE renderEmpleadoRowHeader
const headerStartIdx = content.indexOf('window.renderEmpleadoRowHeader =');
const headerEndIdx = content.indexOf('};', headerStartIdx) + 2;

const newHeader = `window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {
    if (employee?.isVacante) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:800; color:#ef4444; font-size:0.82rem; line-height:1.3;">⚠️ VACANTE</span>
            <span style="color:#64748b; font-size:0.6rem; font-weight:500;">Sin cubrir (\${escapeHtml(employee.titularOriginal)})</span>
        </div>\`;
    }

    const name = escapeHtml(employee?.nombre || employee?.displayName || 'Empleado');
    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : '';
    
    if (employee?.isAbsentInformative) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px; opacity:0.6;">
            <span style="font-weight:700; color:#64748b; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}</span>
            <span style="color:#94a3b8; font-size:0.55rem; font-weight:700; text-transform:uppercase;">Ausencia</span>
        </div>\`;
    }

    const isExplicitRefuerzo = Boolean(employee?.isRefuerzo === true || employee?.origen === 'refuerzo' || employee?.payload?.tipo_modulo === 'refuerzo');
    const supportBadge = isExplicitRefuerzo ? \`<span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;margin-left:6px;">REFUERZO</span>\` : '';

    return \`
    <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#0f172a; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}\${supportBadge}</span>
    </div>\`;
};`;

if (headerStartIdx !== -1) {
    content = content.substring(0, headerStartIdx) + newHeader + content.substring(headerEndIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Inherited Position + Move to End logic applied.");
