const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

let balance = 0;
for (let i = 7114; i < 7134; i++) { // 7115 to 7134
    const line = lines[i];
    const opens = (line.match(/\(/g) || []).length;
    const closes = (line.match(/\)/g) || []).length;
    balance += (opens - closes);
    console.log(`L${i+1} [${opens}-${closes}] Bal:${balance}: ${line.trim()}`);
}
