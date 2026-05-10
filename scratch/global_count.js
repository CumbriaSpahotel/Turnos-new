const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

const opens = (content.match(/\(/g) || []).length;
const closes = (content.match(/\)/g) || []).length;
console.log(`Global ( : ${opens}`);
console.log(`Global ) : ${closes}`);
console.log(`Diff: ${opens - closes}`);
