const fs = require('fs');
const jsPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

const utilitiesHeader = `// --- UTILIDADES GLOBALES ---
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => document.querySelectorAll(s);

window.safeGet = (id) => document.getElementById(id) || { textContent: '', style: {}, innerHTML: '', value: '' };

window.isoDate = (date) => {
    if (!date) return null;
    const d = (typeof date === 'string') ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return \`\${y}-\${m}-\${day}\`;
};`;

// Encontrar el inicio de isoDate (o lo que haya quedado) y reemplazar todo hasta ahí
const isoDateIdx = js.indexOf('window.isoDate =');
if (isoDateIdx !== -1) {
    const endOfIsoDate = js.indexOf('};', isoDateIdx) + 2;
    js = utilitiesHeader + js.slice(endOfIsoDate);
} else {
    js = utilitiesHeader + '\n' + js;
}

fs.writeFileSync(jsPath, js);
console.log("admin.js header reconstructed.");
