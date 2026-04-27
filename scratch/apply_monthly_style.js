
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE getEmployees to handle multi-week months better
// We'll modify the sorting to use the minimum order found for each employee in the period
const getEmpsStart = '    const getEmployees = () => {';
const getEmpsEnd = 'return result;';
const getEmpsStartIdx = content.indexOf(getEmpsStart);

const updatedGetEmployees = `    const getEmployees = () => {
        const firstDate = dates[0] || '';
        const operativeRows = [];
        const absentRows = [];
        const handledEmpsAsActive = new Set();
        
        // A. Pre-procesar estados de la semana/mes
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

        // C. Construcción de filas (Deduplicadas para el Mes)
        sourceRows.forEach(r => {
            const normT = window.normalizeId(r.empleadoId);
            const assignment = puestoAssignments.get(normT);
            if (!assignment) return;

            const v9Order = window.getV9ExcelOrder(hotel, r.week_start || firstDate, r.empleadoId);
            
            // Fila informativa si está ausente
            const status = weekStatus.get(normT);
            if (status && status.tipo !== 'REFUERZO') {
                const tProfile = employees.find(e => window.normalizeId(e.id) === normT || window.normalizeId(e.nombre) === normT);
                // En el mes, solo añadimos la fila ausente si no trabajó NADA en el periodo
                // Pero para simplificar y cumplir con "Ausencias al final", lo mantenemos
                absentRows.push({
                    ...r,
                    employee_id: r.empleadoId,
                    nombre: tProfile?.nombre || r.empleadoId,
                    isAbsentInformative: true,
                    puestoOrden: v9Order + 100000 
                });
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

if (getEmpsStartIdx !== -1) {
    const endIdx = content.indexOf('};', content.indexOf('return ', getEmpsStartIdx)) + 2;
    content = content.substring(0, getEmpsStartIdx) + updatedGetEmployees + content.substring(endIdx);
}

// 2. UPDATE renderPreview HTML for Monthly Style
const renderPreviewTableHtml = `
            if (renderEmployeeTable) {
                const isWeekly = (new Date(endISO) - new Date(startISO)) < (8 * 24 * 60 * 60 * 1000);
                const tableClass = isWeekly ? 'preview-table-premium' : 'preview-table-compact';
                const thWidth = isWeekly ? '220px' : '180px';
                const thPadding = isWeekly ? '15px 25px' : '10px 15px';
                const cellPadding = isWeekly ? '8px' : '4px';
                const minColWidth = isWeekly ? '145px' : '85px';

                const hotelSection = document.createElement('div');
                hotelSection.innerHTML = \`
                <div class="glass-panel" style="margin-bottom:3rem; padding:0; overflow:hidden; border:1px solid #e2e8f0; background:white; border-radius:16px;">
                    <div style="padding:18px 25px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:15px; background:#f8fafc;">
                        <img src="\${hName.toLowerCase().includes('guadiana') ? 'guadiana logo.jpg' : 'cumbria logo.jpg'}" style="width:38px; height:38px; object-fit:contain;">
                        <h2 style="margin:0; font-size:1.1rem; color:#1e293b; font-weight:800;">\${hName} <span style="color:#94a3b8; font-size:0.85rem;">\${isWeekly ? \`Semana \${window.fmtDateLegacy(startISO)}\` : \`\${window.fmtDateLegacy(startISO)} - \${window.fmtDateLegacy(endISO)}\`}</span></h2>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="\${tableClass}" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:\${thPadding}; text-align:left; border-bottom:1px solid #f1f5f9; width:\${thWidth}; color:#64748b; font-size:0.7rem; text-transform:uppercase; position:sticky; left:0; background:#f8fafc; z-index:10; border-right:1px solid #f1f5f9;">Empleado</th>
                                    \${columns.map(c => \`<th style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:\${minColWidth}; border-left:1px solid #f1f5f9;"><div style="font-size:0.65rem; color:#94a3b8;">\${c.dayName}</div><div style="font-size:0.75rem; font-weight:600;">\${c.dayDisplay.toLowerCase()}</div></th>\`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                \${deduplicatedList.map(employee => \`
                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:\${isWeekly ? '12px 25px' : '8px 15px'}; background:white; position:sticky; left:0; z-index:5; border-right:1px solid #f1f5f9;">
                                            \${window.renderEmpleadoRowHeader(employee, { showVacationIcon: true })}
                                        </td>
                                        \${columns.map(c => \`<td style="padding:\${cellPadding}; text-align:center; border-left:1px solid #f1f5f9;">\${window.renderEmpleadoCell(previewModel.getTurnoEmpleado(employee.employee_id, c.date), { isCompact: !isWeekly })}</td>\`).join('')}
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>\`;
                area.appendChild(hotelSection);
            } else {`;

const oldRenderTableStart = '            if (renderEmployeeTable) {';
const oldRenderTableEnd = '            } else {';
const tableStartIdx = content.indexOf(oldRenderTableStart);
const tableEndIdx = content.indexOf(oldRenderTableEnd, tableStartIdx);

if (tableStartIdx !== -1 && tableEndIdx !== -1) {
    content = content.substring(0, tableStartIdx) + renderPreviewTableHtml + content.substring(tableEndIdx + 8);
}

// 3. UPDATE renderEmpleadoCell for compact mode
const cellStart = 'window.renderEmpleadoCell = (turnoEmpleado) => {';
const newCell = `window.renderEmpleadoCell = (turnoEmpleado, { isCompact = false } = {}) => {
    if (!turnoEmpleado) return '<div class="preview-cell-empty"></div>';
    
    const key = window.TurnosRules?.shiftKey(turnoEmpleado.turno || '', 'NORMAL') || 'empty';
    const def = window.TurnosRules?.definitions?.[key] || window.TurnosRules?.definitions?.empty || { adminStyle: '' };
    
    // Vista Mensual (Compact): Menos padding, bordes redondeados suaves
    const style = isCompact 
        ? \`display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px 2px; border-radius:6px; font-size:0.7rem; font-weight:700; min-height:45px; \${def.adminStyle}\`
        : \`display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px 8px; border-radius:10px; font-size:0.8rem; font-weight:800; min-height:75px; \${def.adminStyle}\`;

    const label = turnoEmpleado.incidencia || turnoEmpleado.turno || '—';
    const icons = (turnoEmpleado.incidencia === 'VAC' ? '🏖️' : '') + (turnoEmpleado.cambio ? ' 🔄' : '');

    return \`<div style="\${style}">\${escapeHtml(label)}\${icons ? \` <span style="font-size:0.7rem;">\${icons}</span>\` : ''}</div>\`;
};`;

const cellStartIdx = content.indexOf(cellStart);
if (cellStartIdx !== -1) {
    const endIdx = content.indexOf('};', cellStartIdx) + 2;
    content = content.substring(0, cellStartIdx) + newCell + content.substring(endIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Compact Monthly View implemented.");
