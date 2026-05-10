const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

let parens = 0;
let inString = null;
let inComment = null;
let inRegex = false;

const lines = content.split('\n');
for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const oldParens = parens;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const next = line[i+1];
        
        if (inComment === 'line') break;
        if (inComment === 'block') {
            if (c === '*' && next === '/') { inComment = null; i++; }
            continue;
        }
        if (inString) {
            if (c === '\\') { i++; continue; }
            if (c === inString) inString = null;
            continue;
        }
        if (inRegex) {
            if (c === '\\') { i++; continue; }
            if (c === '/') inRegex = false;
            continue;
        }
        if (c === '/' && next === '/') { inComment = 'line'; i++; continue; }
        if (c === '/' && next === '*') { inComment = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
        
        if (c === '/' && i > 0 && /[\(\,\[\=\:\!]/.test(line[i-1].trim() || '(')) {
            inRegex = true;
            continue;
        }

        if (c === '(') parens++;
        if (c === ')') parens--;
    }
    if (inComment === 'line') inComment = null;
    
    if (lineIdx > 8400) {
        console.log(`L${lineIdx+1} balance: ${parens} (change: ${parens - oldParens}) | ${line.trim()}`);
    }
}
