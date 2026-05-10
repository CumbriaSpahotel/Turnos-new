const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

let inString = null;
let lastStringLine = 0;

for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inString) {
        if (c === '\\') { i++; continue; }
        if (c === inString) { inString = null; continue; }
    } else {
        if (c === '"' || c === "'" || c === '`') {
            inString = c;
            lastStringLine = content.substring(0, i).split('\n').length;
        }
    }
}

if (inString) {
    console.log(`Unclosed string ${inString} starting at line ${lastStringLine}`);
} else {
    console.log('All strings closed.');
}
