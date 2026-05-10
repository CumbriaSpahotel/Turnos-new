const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

const matches = [];
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('—(')) {
        matches.push({ line: i + 1, content: lines[i].trim() });
    }
}

console.log(JSON.stringify(matches, null, 2));
