const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix renderEmpleadoCell icon logic to prevent duplication and ensure neutral colors
const targetCellStart = `    const hasSyncIcon = iconHtml.includes('\\u{1F504}') || (turnoEmpleado.icons && turnoEmpleado.icons.includes('\\u{1F504}'));
        if (hayCambio && !hasSyncIcon && !['VAC', 'BAJA', 'PERM'].includes(styleKey)) {
            iconHtml += \` <span style="margin-left:4px;">\\u{1F504}</span>\`;
        }

        return \`
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:75px; gap:4px;">
            <span class="v-pill" style="display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; border-radius:999px; font-size:0.8rem; font-weight:800; background:\${style.bg}; color:\${style.color}; border:1px solid \${style.border}; box-shadow:0 1px 3px rgba(0,0,0,0.06); white-space:nowrap;">
                \${escapeHtml(label)}\${iconHtml}
            </span>`;

const replacementCell = `        const iconsToRender = new Set();
        if (style.icon) iconsToRender.add(style.icon);
        if (turnoEmpleado.icon) iconsToRender.add(turnoEmpleado.icon);
        if (Array.isArray(turnoEmpleado.icons)) {
            turnoEmpleado.icons.forEach(i => { if (i) iconsToRender.add(i); });
        }
        
        if (hayCambio) iconsToRender.add('\\u{1F504}');

        let iconHtml = '';
        iconsToRender.forEach(icon => {
            const isSync = icon === '\\u{1F504}';
            iconHtml += \` <span style="margin-left:4px;\${isSync ? 'color:initial !important;' : ''}">\${icon}</span>\`;
        });

        return \`
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:75px; gap:4px;">
            <span class="v-pill" style="display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; border-radius:999px; font-size:0.8rem; font-weight:800; background:\${style.bg}; color:\${style.color}; border:1px solid \${style.border}; box-shadow:0 1px 3px rgba(0,0,0,0.06); white-space:nowrap;">
                \${escapeHtml(label)}\${iconHtml}
            </span>\`;`;

// Note: Using a simpler search for targetCellStart because of possible spacing differences
const searchPart = `const hasSyncIcon = iconHtml.includes('\\u{1F504}')`;
if (content.includes(searchPart)) {
    // Find the whole block from hasSyncIcon to </span>`
    const startIdx = content.indexOf(searchPart);
    const endMark = `</span>\`;`;
    const endIdx = content.indexOf(endMark, startIdx) + endMark.length;
    if (startIdx > -1 && endIdx > startIdx) {
        content = content.slice(0, startIdx) + replacementCell + content.slice(endIdx);
    }
}

// 2. Harder filter for getEmployees to eliminate phantom rows
const targetFilter = `return [...operationalRows, ...absentRows, ...extraRefuerzoRows].filter(r => r.employee_id && r.nombre && r.nombre !== 'Empleado');`;
const replacementFilter = `return [...operationalRows, ...absentRows, ...extraRefuerzoRows].filter(r => {
            const validId = r.employee_id && !String(r.employee_id).includes('---') && !String(r.employee_id).includes('___');
            const validName = r.nombre && r.nombre !== 'Empleado' && r.nombre.trim().length > 1;
            return validId && validName;
        });`;

if (content.includes(targetFilter)) {
    content = content.replace(targetFilter, replacementFilter);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.js icons and phantom row filtering hardened');
