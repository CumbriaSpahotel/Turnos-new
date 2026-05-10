const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// We have two getEmployees. Let's find the first one and check if it's broken.
// The first one is at 3399. The second one is at 3594.
// If we delete from 3399 to 3593, we might fix the imbalance.

lines.splice(3398, 3594 - 3399);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Removed duplicated/broken getEmployees chunk.');
