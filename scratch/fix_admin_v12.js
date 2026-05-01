const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix Empty Rows
const targetLoop = `            employeesToRender.forEach(emp => {
                const key = emp.employee_id;
                if (!seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });`;

const replacementLoop = `            employeesToRender.forEach(emp => {
                const key = emp.employee_id || emp.id || '';
                const name = emp.nombreVisible || emp.displayName || emp.nombre || '';
                if (key && name && !seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });`;

if (content.includes(targetLoop)) {
    content = content.replace(targetLoop, replacementLoop);
}

// 2. Fix renderEmpleadoCell (Duplication and Icons)
// I'll search for the specific lines to avoid breaking the function
const lines = content.split('\n');
let insideCell = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('window.renderEmpleadoCell =')) insideCell = true;
    if (insideCell) {
        // Fix Vacations Icon (ensure correct emoji)
        if (lines[i].includes("'Vacaciones'") && lines[i].includes("icon:")) {
            lines[i] = lines[i].replace(/icon: '.*'/, "icon: '🏖️'");
        }
        // Fix Noche Icon
        if (lines[i].includes("'Noche'") && lines[i].includes("icon:")) {
            lines[i] = lines[i].replace(/icon: '.*'/, "icon: '🌙'");
        }
        // Fix Duplication Logic
        if (lines[i].includes('if (hayCambio && ![\'VAC\',\'BAJA\',\'PERM\'].includes(styleKey))')) {
            // We only add 🔄 if it's NOT already in the icons/icon list
            lines[i] = "        const hasSyncIcon = iconHtml.includes('🔄') || (turnoEmpleado.icons && turnoEmpleado.icons.includes('🔄'));";
            lines[i+1] = "        if (hayCambio && !hasSyncIcon && !['VAC','BAJA','PERM'].includes(styleKey)) {";
        }
    }
    if (lines[i].includes('return `') && insideCell) {
        // End of main logic
        // insideCell = false; // keep true until the end of the file or next function to be safe
    }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Successfully updated admin.js via script');
