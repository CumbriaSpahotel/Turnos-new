const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

const stack = [];
let inString = null;
let inComment = null;

const lines = content.split('\n');
for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const next = line[i+1];
        if (inComment === 'line') break;
        if (inComment === 'block') { if (c === '*' && next === '/') { inComment = null; i++; } continue; }
        if (inString) {
            if (c === '\\') { i++; continue; }
            if (c === inString) inString = null;
            continue;
        }
        if (c === '/' && next === '/') { inComment = 'line'; i++; continue; }
        if (c === '/' && next === '*') { inComment = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = c; continue; }

        if (c === '[') stack.push(lineIdx + 1);
        if (c === ']') {
            if (stack.length === 0) {
                console.log(`EXTRA ] at line ${lineIdx + 1}: ${line.trim()}`);
            } else {
                stack.pop();
            }
        }
    }
    if (inComment === 'line') inComment = null;
}

if (stack.length > 0) {
    console.log(`UNCLOSED [ at lines: ${stack.join(', ')}`);
} else {
    console.log('All brackets balanced.');
}
