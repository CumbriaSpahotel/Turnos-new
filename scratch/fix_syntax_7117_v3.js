const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let found = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Solo refrescar dashboard') && lines[i].includes('#section-home')) {
        console.log(`Found corrupted line at index ${i}: ${lines[i]}`);
        lines[i] = "    if ($('#section-home').classList.contains('active')) {";
        found = true;
    }
}

if (found) {
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Fixed syntax error in aplicarCambioLocal using index search.');
} else {
    console.log('Line not found via index search.');
}
