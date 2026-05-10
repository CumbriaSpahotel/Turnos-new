const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

let count = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('—')) {
        console.log(`L${i+1}: ${lines[i].trim()}`);
        count++;
        if (count >= 50) break;
    }
}
