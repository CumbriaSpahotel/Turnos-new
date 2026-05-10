const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

let braces = 0;
let parens = 0;
let brackets = 0;
let inString = null;
let inComment = null;

for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i+1];
    
    if (inComment === 'line') {
        if (c === '\n') inComment = null;
        continue;
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
}

console.log(`Braces balance: ${braces}`);
console.log(`Parens balance: ${parens}`);
console.log(`Brackets balance: ${brackets}`);
