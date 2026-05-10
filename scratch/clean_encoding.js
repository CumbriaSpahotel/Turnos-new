const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// Remove characters that are known to be part of the mojibake mess
// and could potentially confuse the parser if they are mis-encoded.
// We'll replace them with space or ? to keep positions mostly similar.
content = content.replace(/[^\x00-\x7F\xA0-\xFF]/g, ' ');

// Also fix the specific lines we found
content = content.replace(/\/\/ Llenar empleados y hoteles si no est—\[hotels, emps\]/g, 'const [hotels, emps]');
content = content.replace(/\/\/ Usamos fetchEventos general para m—= data.find/g, 'const match = data.find');

fs.writeFileSync(path, content, 'utf8');
console.log('Cleaned non-ASCII/Latin-1 characters and fixed known merged lines.');
