const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// Global cleanup of "inv—" which was used as a placeholder for "inválido" or similar
content = content.replace(/inv—/g, 'inválido');

fs.writeFileSync(path, content, 'utf8');
console.log('Final string cleanup complete.');
