const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

let braces = 0;
let parens = 0;
let brackets = 0;
let inString = null;
let inComment = null;

const lines = content.split('\n');
for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const next = line[i+1];
        
        if (inComment === 'line') {
            break; // Skip rest of line
        }
        if (inComment === 'block') {
            if (c === '*' && next === '/') {
                inComment = null;
                i++;
            }
            continue;
        }
        
        if (inString) {
            if (c === '\\') {
                i++;
                continue;
            }
            if (c === inString) {
                inString = null;
            }
            continue;
        }
        
        if (c === '/' && next === '/') {
            inComment = 'line';
            i++;
            continue;
        }
        if (c === '/' && next === '*') {
            inComment = 'block';
            i++;
            continue;
        }
        
        if (c === '"' || c === "'" || c === '`') {
            inString = c;
            continue;
        }
        
        if (c === '{') braces++;
        if (c === '}') braces--;
        if (c === '(') parens++;
        if (c === ')') parens--;
        if (c === '[') brackets++;
        if (c === ']') brackets--;
        
        if (braces < 0 || parens < 0 || brackets < 0) {
            console.log(`NEGATIVE BALANCE at line ${lineIdx + 1}, char ${i + 1}: ${c}`);
            console.log(`Line content: ${line}`);
            console.log(`Braces: ${braces}, Parens: ${parens}, Brackets: ${brackets}`);
            process.exit(0);
        }
    }
    if (inComment === 'line') inComment = null;
}
