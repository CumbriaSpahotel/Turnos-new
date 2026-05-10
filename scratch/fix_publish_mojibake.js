const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

const replacements = {
    'protecciÃ³n': 'protección',
    'CrÃ­ticos': 'Críticos',
    'mÃ¡s': 'más',
    'volverÃ¡n': 'volverán',
    'crearÃ¡': 'creará',
    'versiÃ³n': 'versión',
    'Ãºnica': 'única',
    'PÃºblico': 'Público',
    'tambiÃ©n': 'también',
    'sincronizarÃ¡n': 'sincronizarán',
    'dÃ­a': 'día',
    'cÃ³digo': 'código',
    'CÃ³digos': 'Códigos',
    'ValidaciÃ³n': 'Validación'
};

for (const [bad, good] of Object.entries(replacements)) {
    content = content.split(bad).join(good);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed mojibake in admin.js');
