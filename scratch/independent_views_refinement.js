
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE formatDisplayName to use the requested regex exactly
const oldFormatHelperStart = 'window.formatDisplayName = (name) => {';
const newFormatHelper = `window.formatDisplayName = (name) => {
    if (!name) return '';
    // REGLA: Eliminar prefijo _DUP_ y cualquier sufijo posterior como _CT, _2, etc.
    return name.replace(/_DUP_.*$/, '').replace(/_CT$/, '').replace(/_/g, ' ').trim();
};`;

const helperIdx = content.indexOf(oldFormatHelperStart);
if (helperIdx !== -1) {
    const endIdx = content.indexOf('};', helperIdx) + 2;
    content = content.substring(0, helperIdx) + newFormatHelper + content.substring(endIdx);
}

// 2. UPDATE getEmployees to support Monthly view filtering
const getEmpsStart = '    const getEmployees = () => {';
const newGetEmployees = `    const getEmployees = (viewType = 'weekly') => {
        const firstDate = dates[0] || '';
        const operativeRows = [];
        const absentRows = [];
        const handledEmpsAsActive = new Set();
        
        // A. Pre-procesar estados
        const weekStatus = new Map(); 
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

            weekStatus.set(normT, { tipo, sustitutoId: sRaw ? window.normalizeId(sRaw) : null, rawSust: sRaw, titularId: tId });
        });

        // B. Mapa de "Quién ocupa qué puesto base"
        const puestoAssignments = new Map();
        sourceRows.forEach(r => {
            if (String(r.empleadoId || '').includes('---') || String(r.empleadoId || '').includes('___')) return;
            const normT = window.normalizeId(r.empleadoId);
            const status = weekStatus.get(normT);
            if (status) {
                if (status.sustitutoId) puestoAssignments.set(normT, { occupantId: status.rawSust, isSustitucion: true });
                else if (status.tipo !== 'REFUERZO') puestoAssignments.set(normT, { occupantId: 'VACANTE-' + normT, isVacante: true });
                else puestoAssignments.set(normT, { occupantId: r.empleadoId });
            } else {
                puestoAssignments.set(normT, { occupantId: r.empleadoId });
            }
        });

        // C. Construcción de filas
        sourceRows.forEach(r => {
            const normT = window.normalizeId(r.empleadoId);
            const assignment = puestoAssignments.get(normT);
            if (!assignment) return;

            const v9Order = window.getV9ExcelOrder(hotel, r.week_start || firstDate, r.empleadoId);
            
            // Fila informativa si está ausente (SOLO EN SEMANAL)
            if (viewType === 'weekly') {
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
            }

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
            operativeRows.push({ hotel, employee_id: empId, nombre: empProfile?.nombre || empId, puestoOrden: 200000, isRefuerzo: true });
            handledEmpsAsActive.add(normEmpId);
        });

        const result = [...operativeRows, ...absentRows];
        result.sort((a, b) => {
            if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        
        return result;
    };`;

const getEmpsStartIdx = content.indexOf(getEmpsStart);
if (getEmpsStartIdx !== -1) {
    const endIdx = content.indexOf('};', content.indexOf('return ', getEmpsStartIdx)) + 2;
    content = content.substring(0, getEmpsStartIdx) + newGetEmployees + content.substring(endIdx);
}

// 3. UPDATE renderPreview to pass viewType
const renderPrevCallStart = '            const employeesToRender = previewModel.getEmpleadosVisibles';
const newRenderPrevCall = `            const viewType = isWeekly ? 'weekly' : 'monthly';
            const employeesToRender = previewModel.getEmployees(viewType);`;
const callIdx = content.indexOf(renderPrevCallStart);
if (callIdx !== -1) {
    const endCallIdx = content.indexOf(': employeesToRender;', callIdx) + 20;
    content = content.substring(0, callIdx) + newRenderPrevCall + content.substring(endCallIdx);
}

// 4. UPDATE renderEmpleadoRowHeader to remove subtitles and labels
const headerStart = 'window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false, isCompact = false } = {}) => {';
const newHeader = `window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false, isCompact = false } = {}) => {
    const rawName = employee?.nombre || employee?.displayName || 'Empleado';
    if (rawName.includes('---') || rawName.includes('___')) return '';

    if (employee?.isVacante) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:800; color:#ef4444; font-size:0.82rem; line-height:1.3;">⚠️ VACANTE</span>
        </div>\`;
    }

    const name = escapeHtml(window.formatDisplayName(rawName));
    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : '';
    
    if (employee?.isAbsentInformative) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px; opacity:0.6;">
            <span style="font-weight:700; color:#64748b; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}</span>
        </div>\`;
    }

    const isExplicitRefuerzo = Boolean(employee?.isRefuerzo === true || employee?.origen === 'refuerzo' || employee?.payload?.tipo_modulo === 'refuerzo');
    const supportBadge = isExplicitRefuerzo ? \`<span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;margin-left:6px;">REFUERZO</span>\` : '';

    return \`
    <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#0f172a; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}\${supportBadge}</span>
    </div>\`;
};`;

const headerIdx = content.indexOf(headerStart);
if (headerIdx !== -1) {
    const endHeaderIdx = content.indexOf('};', headerIdx) + 2;
    content = content.substring(0, headerIdx) + newHeader + content.substring(endHeaderIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: RADICAL separation of Weekly and Monthly views applied.");
