const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// Use a very flexible regex to find the corrupted line 7117
const regex = /\/\/ Solo refrescar dashboard si est.+.section-home..classList\.contains..active...\) \{/;
const fixedLine = `    // Solo refrescar dashboard si la sección home está activa
    if ($('#section-home').classList.contains('active')) {`;

if (regex.test(content)) {
    content = content.replace(regex, fixedLine);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed syntax error in aplicarCambioLocal with flexible regex.');
} else {
    console.log('Line not found even with flexible regex.');
}
