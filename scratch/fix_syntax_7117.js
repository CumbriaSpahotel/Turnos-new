const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

const corruptedLine = /\/\/ Solo refrescar dashboard si est—\(\$('#section-home')\.classList\.contains\('active'\)\) \{/;
const fixedLine = `    // Solo refrescar dashboard si está activa la sección home
    if ($('#section-home').classList.contains('active')) {`;

if (corruptedLine.test(content)) {
    content = content.replace(corruptedLine, fixedLine);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed syntax error in aplicarCambioLocal.');
} else {
    console.log('Corrupted line not found.');
}
