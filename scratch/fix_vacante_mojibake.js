const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

const regex1 = /Ã Æ Ã â {4}â {4}â {4}â {4}â {4}â {4}â {4}â {4}â {4}â {4}â {4}â {5}VACANTE/g;
content = content.replace(regex1, '<i class="fas fa-exclamation-triangle"></i> VACANTE');

const regex2 = /\/\/ REGLA: Las vacantes son avisos operativos, no bloqueos autom \.push\(`\[AVISO\]/g;
content = content.replace(regex2, '// REGLA: Las vacantes son avisos operativos, no bloqueos automáticos\n                        errors.push(`[AVISO]');

const regex3 = /code !== 'Ã Æ Ã â {4}â {4}â {4}â {4}â {4}â {4}â {4}'/g;
content = content.replace(regex3, "code !== '-'");

// Let's also check for any generic Ã Æ Ã â remaining.
const regex4 = /Ã Æ Ã â[\sâ]+/g;
content = content.replace(regex4, '-');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed mojibake around VACANTE and errors.push.');
