
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// Update formatDisplayName with better regex
const oldHelperStart = 'window.formatDisplayName = (name) => {';
const newHelper = `window.formatDisplayName = (name) => {
    if (!name) return '';
    // Limpieza de sufijos y prefijos técnicos (_DUP_, _CT, guiones bajos)
    return name
        .replace(/^_DUP_/, '')      // Quitar _DUP_ al inicio
        .replace(/_DUP_.*$/, '')    // Quitar _DUP_ y lo que siga si está en medio/final
        .replace(/_CT$/, '')        // Quitar _CT al final
        .replace(/_/g, ' ')         // Cambiar guiones bajos por espacios
        .trim();
};`;

const helperStartIdx = content.indexOf(oldHelperStart);
if (helperStartIdx !== -1) {
    const endIdx = content.indexOf('};', helperStartIdx) + 2;
    content = content.substring(0, helperStartIdx) + newHelper + content.substring(endIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Improved name cleaning regex.");
