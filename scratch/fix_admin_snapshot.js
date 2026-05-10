const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const target = `                            titular_cubierto: resolved.titular || null,
                            sustituto: resolved.sustituidoPor || null,
                            origen: resolved.origen || 'base'`;

const replacement = `                            titular_cubierto: resolved.coversEmployeeId || resolved.sustituyeA || null,
                            incidenciaCubierta: resolved.coveredType || resolved.incidenciaCubierta || null,
                            sustituto: resolved.coveredByEmployeeId || resolved.sustituidoPor || null,
                            origen: resolved.origen || 'base'`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated admin.js');
} else {
    // Try with \r\n
    const targetRN = target.replace(/\n/g, '\r\n');
    const replacementRN = replacement.replace(/\n/g, '\r\n');
    if (content.includes(targetRN)) {
        content = content.replace(targetRN, replacementRN);
        fs.writeFileSync(path, content, 'utf8');
        console.log('Successfully updated admin.js (with CRLF)');
    } else {
        console.log('Target content not found in admin.js');
        // Let's try a fuzzy match or just a single line
        if (content.includes('titular_cubierto: resolved.titular || null,')) {
             console.log('Found single line, updating one by one');
             content = content.replace('titular_cubierto: resolved.titular || null,', 'titular_cubierto: resolved.coversEmployeeId || resolved.sustituyeA || null,\n                            incidenciaCubierta: resolved.coveredType || resolved.incidenciaCubierta || null,');
             fs.writeFileSync(path, content, 'utf8');
        }
    }
}
