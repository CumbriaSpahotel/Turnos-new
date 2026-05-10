const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const target = /titular_cubierto: resolved\.titular \|\| null,\s*sustituto: resolved\.sustituidoPor \|\| null,/;
const replacement = `titular_cubierto: resolved.coversEmployeeId || resolved.sustituyeA || resolved.titular || null,
                            incidenciaCubierta: resolved.coveredType || resolved.incidenciaCubierta || null,
                            sustituto: resolved.coveredByEmployeeId || resolved.sustituidoPor || null,`;

if (target.test(content)) {
    console.log('Found target in admin.js');
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated admin.js');
} else {
    console.log('Target not found in admin.js');
    // Try without spaces
    const target2 = /titular_cubierto: resolved\.titular \|\| null,[\s\n\r]*sustituto: resolved\.sustituidoPor \|\| null,/;
    if (target2.test(content)) {
        console.log('Found target2 in admin.js');
        content = content.replace(target2, replacement);
        fs.writeFileSync(path, content, 'utf8');
        console.log('Successfully updated admin.js (target2)');
    }
}
