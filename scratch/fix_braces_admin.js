const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// Fix the braces in validatePublishChanges
const start = content.indexOf('window.validatePublishChanges = (changes) => {');
const end = content.indexOf('return errors;', start);

if (start !== -1 && end !== -1) {
    const section = content.substring(start, end + 15);
    const fixedSection = `window.validatePublishChanges = (changes) => {
    const errors = [];
    const validShifts = new Set(['M', 'T', 'N', 'D', 'VAC', 'BAJA', 'PERM', '']);

    changes.forEach(c => {
        // 1. Empleados sin ID
        if (!c.displayName || c.displayName === '?' || c.displayName.length < 2) {
            errors.push(\`Empleado con nombre inválido \${c.weekStart}: "\${c.displayName}"\`);
        }

        // 2. Fechas inconsistentes
        if (!c.weekStart || isNaN(new Date(c.weekStart).getTime())) {
            errors.push(\`Fecha de semana inválida \${c.displayName}: \${c.weekStart}\`);
        }

        // 3. Turnos inválidos
        if (c.row && c.row.values) {
            c.row.values.forEach((v, idx) => {
                const vNorm = String(v || '').toUpperCase().trim();
                if (vNorm && !validShifts.has(vNorm)) {
                    if (vNorm.length > 10) {
                        errors.push(\`Turno sospechoso en \${c.weekStart} (\${c.displayName}): \${vNorm}\`);
                    }
                }
            });
        }
    });

    return errors;`;
    
    content = content.replace(section, fixedSection);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Braces and strings fixed in validatePublishChanges.');
} else {
    console.log('Section not found.');
}
