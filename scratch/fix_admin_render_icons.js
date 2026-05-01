const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const targetIf = `        const hasSyncIcon = iconHtml.includes('🔄') || (turnoEmpleado.icons && turnoEmpleado.icons.includes('🔄'));
        if (hayCambio && !hasSyncIcon && !['VAC', 'BAJA', 'PERM'].includes(styleKey)) {
            iconHtml += \` <span style="margin-left:4px;">🔄</span>\`;
        }`;

const replacementIf = `        const hasSyncIcon = iconHtml.includes('\\u{1F504}') || (turnoEmpleado.icons && turnoEmpleado.icons.includes('\\u{1F504}'));
        if (hayCambio && !hasSyncIcon && !['VAC', 'BAJA', 'PERM'].includes(styleKey)) {
            iconHtml += \` <span style="margin-left:4px;">\\u{1F504}</span>\`;
        }`;

// Try direct replacement if literals are still there
if (content.includes(targetIf)) {
    content = content.replace(targetIf, replacementIf);
} else {
    // Fallback regex in case of partial corruption
    const regex = /const hasSyncIcon = iconHtml\.includes\('.*?'\) \|\| \(turnoEmpleado\.icons && turnoEmpleado\.icons\.includes\('.*?'\)\);\s+if \(hayCambio && !hasSyncIcon && !\['VAC', 'BAJA', 'PERM'\]\.includes\(styleKey\)\) \{\s+iconHtml \+= ` <span style="margin-left:4px;">.*?<\/span>`;\s+\}/;
    content = content.replace(regex, replacementIf);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.js renderEmpleadoCell icons fixed');
