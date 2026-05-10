const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let found = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('.saveEmployeeProfileV2 = async (event) => {')) {
        console.log(`Found corrupted save profile line at index ${i}`);
        lines[i] = "window.saveEmployeeProfileV2 = async (event) => {";
        found = true;
    }
}

if (found) {
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Fixed saveEmployeeProfileV2 using index search.');
} else {
    console.log('Line not found via index search.');
}
