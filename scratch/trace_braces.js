const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

let braces = 0;
let inString = null;
let inComment = null;

const lines = content.split('\n');
for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const oldBraces = braces;
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
        if (c === '/' && next === '/') { inComment = 'line'; i++; continue; }
        if (c === '/' && next === '*') { inComment = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
        
        if (c === '{') braces++;
        if (c === '}') braces--;
    }
    if (inComment === 'line') inComment = null;
    
    if (braces > oldBraces) {
        // console.log(`Braces UP at line ${lineIdx + 1}: ${line.trim()}`);
    }
    if (braces < oldBraces && braces < 0) {
        console.log(`NEGATIVE BRACES at line ${lineIdx + 1}`);
    }
}
console.log(`Final braces balance: ${braces}`);

// Let's find large jumps or stay-highs
braces = 0;
for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const oldBraces = braces;
    // (repeat same logic as above)
    for (let i = 0; i < line.length; i++) {
        const c = line[i]; const next = line[i+1];
        if (inComment === 'line') break;
        if (inComment === 'block') { if (c === '*' && next === '/') { inComment = null; i++; } continue; }
        if (inString) { if (c === '\\') { i++; continue; } if (c === inString) inString = null; continue; }
        if (c === '/' && next === '/') { inComment = 'line'; i++; continue; }
        if (c === '/' && next === '*') { inComment = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
        if (c === '{') braces++; if (c === '}') braces--;
    }
    if (inComment === 'line') inComment = null;
    
    if (lineIdx > 8000) {
         // console.log(`L${lineIdx+1} braces: ${braces}`);
    }
}
