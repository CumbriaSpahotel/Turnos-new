const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const i = 7133; // 7134 1-indexed
console.log(`Line ${i+1}: |${lines[i]}|`);
console.log(`Hex: ${Buffer.from(lines[i]).toString('hex')}`);
