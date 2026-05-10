const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin_clean.js';
const content = fs.readFileSync(path, 'utf8');

let braces = 0;
let inString = null;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (inString) {
            if (c === '\\') { j++; continue; }
            if (c === inString) inString = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
        if (c === '{') braces++;
        if (c === '}') braces--;
    }
    if (braces < 0) console.log(`Negative braces at line ${i+1}`);
}
console.log(`Final balance: ${braces}`);
