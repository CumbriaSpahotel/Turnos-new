
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE renderEmpleadoRowHeader to support isCompact and filter separators
const oldHeaderStart = 'window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {';
const newHeader = `window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false, isCompact = false } = {}) => {
    // VISTA PREVIA: LIMPIEZA INTEGRAL
    const rawName = employee?.nombre || employee?.displayName || 'Empleado';
    
    // Ignorar separadores de texto (---, ____)
    if (rawName.includes('---') || rawName.includes('___')) return '';

    if (employee?.isVacante) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:800; color:#ef4444; font-size:0.82rem; line-height:1.3;">⚠️ VACANTE</span>
            <span style="color:#64748b; font-size:0.6rem; font-weight:500;">Sin cubrir (\${escapeHtml(employee.titularOriginal)})</span>
        </div>\`;
    }

    const name = escapeHtml(window.formatDisplayName(rawName));
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

    // El "Subtítulo" de sustitución solo se muestra en la vista semanal (no compacta)
    const subtitle = (!isCompact && employee?.isSustitucion && employee?.titularOriginal)
        ? \`<span style="color:#64748b; font-size:0.6rem; font-weight:500;">Cubre a \${escapeHtml(employee.titularOriginal)}</span>\`
        : '';

    return \`
    <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#0f172a; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}\${supportBadge}</span>
        \${subtitle}
    </div>\`;
};`;

const headerStartIdx = content.indexOf(oldHeaderStart);
if (headerStartIdx !== -1) {
    const endIdx = content.indexOf('};', headerStartIdx) + 2;
    content = content.substring(0, headerStartIdx) + newHeader + content.substring(endIdx);
}

// 2. UPDATE renderPreview to pass isCompact to renderEmpleadoRowHeader
const oldCall = '${window.renderEmpleadoRowHeader(employee, { showVacationIcon: true })}';
const newCall = '${window.renderEmpleadoRowHeader(employee, { showVacationIcon: true, isCompact: !isWeekly })}';
content = content.replace(oldCall, newCall);

// 3. Ensure getEmployees filters out separators from the list
const getEmpsMarker = 'sourceRows.forEach(r => {';
const getEmpsIndex = content.indexOf(getEmpsMarker);
if (getEmpsIndex !== -1) {
    const nextLine = content.indexOf('\n', getEmpsIndex) + 1;
    const filterLine = "            if (String(r.empleadoId || '').includes('---') || String(r.empleadoId || '').includes('___')) return;\n";
    content = content.substring(0, nextLine) + filterLine + content.substring(nextLine);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Integral cleaning for Monthly View applied.");
