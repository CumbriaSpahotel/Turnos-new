const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const target = '<select class="turno-edit-select" data-hotel="${escapeHtml(row.hotel)}" data-emp="${escapeHtml(row.empId)}" data-date="${dStr}" data-original="${escapeHtml(dbVal)}" style="width:120px; padding:6px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; text-align:center; color:#475569; font-size:0.85rem; margin:auto; cursor:pointer;">';
const replacement = '<select class="turno-edit-select ${mappedVal === \'Pendiente de asignar\' ? \'turno-pendiente-alerta\' : \'\'}" onchange="this.classList.toggle(\'turno-pendiente-alerta\', this.value === \'Pendiente de asignar\')" data-hotel="${escapeHtml(row.hotel)}" data-emp="${escapeHtml(row.empId)}" data-date="${dStr}" data-original="${escapeHtml(dbVal)}" style="width:120px; padding:6px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; text-align:center; color:#475569; font-size:0.85rem; margin:auto; cursor:pointer;">';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated admin.js');
} else {
    console.log('Target not found in admin.js');
    // Try without the exact whitespace
    const targetRegex = /<select class="turno-edit-select"\s+data-hotel="\${escapeHtml\(row\.hotel\)}"\s+data-emp="\${escapeHtml\(row\.empId\)}"\s+data-date="\${dStr}"\s+data-original="\${escapeHtml\(dbVal\)}"\s+style="[^"]+">/;
    if (targetRegex.test(content)) {
        content = content.replace(targetRegex, (match) => {
             return match.replace('<select class="turno-edit-select"', '<select class="turno-edit-select ${mappedVal === \'Pendiente de asignar\' ? \'turno-pendiente-alerta\' : \'\'}" onchange="this.classList.toggle(\'turno-pendiente-alerta\', this.value === \'Pendiente de asignar\')"');
        });
        fs.writeFileSync(path, content, 'utf8');
        console.log('Successfully updated admin.js via regex');
    } else {
        console.log('Regex also failed');
    }
}
