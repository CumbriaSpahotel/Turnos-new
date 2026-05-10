const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// Fix sanitizeUiText
const newSanitize = `window.sanitizeUiText = (value) => {
    if (!value) return '';
    let s = window.fixMojibake(value);
    // Replace known symbol patterns with clean ones
    s = s.replace(/·/g, ' • ')
         .replace(/🔄/g, ' 🔄')
         .replace(/→/g, ' → ')
         .replace(/←/g, ' ← ');
    return s.replace(/\\s{2,}/g, ' ').trim();
};`;

content = content.replace(/window\.sanitizeUiText = \(value\) => \{[\s\S]+?return s\.replace\(\/\\s\{2,\}\/g, ' '\)\.trim\(\);\s+\};/, newSanitize);

// Fix corrupted comments
content = content.replace(/\/\/ DIAGNÃƒÂ Ã‚Â¯\?ÃƒÆ’Ã†â€™—†â€™— Ã‚Â¯\?ÃƒÆ’Ã†â€™—†â€™—_MODE=true/g, '// DEBUG_MODE=false');

fs.writeFileSync(path, content, 'utf8');
console.log('SanitizeUiText fixed.');
