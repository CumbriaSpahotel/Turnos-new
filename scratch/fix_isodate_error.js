
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. EXTRACT the problematic block
const problematicBlock = `window._previewMode = 'weekly';
window._previewDate = window.isoDate(new Date()); // Fecha de referencia global
window._fpWeek = null;
window._fpMonth = null;`;

// Remove it from the top
content = content.replace(problematicBlock, '');

// 2. FIND a safe spot after window.isoDate is defined
const isoDateEnd = '    return `${y}-${m}-${day}`;\\n};';
// Search for the actual string in content (literal, escape backticks/newlines if needed)
// Better search for the end of fmtDateLegacy
const searchToken = 'return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;\\n};';

// Let's just search for line 27-ish
const anchor = 'return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;';
const anchorIdx = content.indexOf(anchor);

if (anchorIdx !== -1) {
    const endOfFunc = content.indexOf('};', anchorIdx) + 2;
    content = content.substring(0, endOfFunc) + '\\n\\n' + problematicBlock + content.substring(endOfFunc);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Moved global state initialization after utility functions.");
