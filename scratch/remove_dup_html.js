const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

const dupStart = content.indexOf('window.escapeHtml = (str) => {');
if (dupStart !== -1) {
    const dupEnd = content.indexOf('};', dupStart) + 2;
    content = content.substring(0, dupStart) + content.substring(dupEnd);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Removed duplicate escapeHtml.');
}
