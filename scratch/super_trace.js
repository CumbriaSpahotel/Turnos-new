const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

const stack = [];
let inString = null;
let inComment = null;
let inRegex = false;

for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i+1];
    
    if (inComment === 'line') { if (c === '\n') inComment = null; continue; }
    if (inComment === 'block') { if (c === '*' && next === '/') { inComment = null; i++; } continue; }
    if (inString) {
        if (c === '\\') { i++; continue; }
        if (inString === '`' && c === '$' && next === '{') {
             // Template interpolation - we need a stack for this too, but for now just skip the {
             stack.push('TEMPLATE_BRACE');
             i++; continue;
        }
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
    
    // Very naive regex detection
    if (c === '/' && i > 0 && /[\(\,\[\=\:\!]/.test(content[i-1].trim() || '(')) { inRegex = true; continue; }

    if (c === '(') stack.push({ type: '(', pos: i });
    if (c === ')') {
        const top = stack.pop();
        if (!top || top.type !== '(') console.log(`Extra ) at pos ${i}`);
    }
    if (c === '{') stack.push({ type: '{', pos: i });
    if (c === '}') {
        const top = stack.pop();
        if (top && top === 'TEMPLATE_BRACE') {
            // End of template interpolation, we are back in the string
        } else if (!top || top.type !== '{') {
            console.log(`Extra } at pos ${i}`);
        }
    }
}

stack.forEach(s => {
    if (s.type) {
        const line = content.substring(0, s.pos).split('\n').length;
        console.log(`UNCLOSED ${s.type} at line ${line}`);
    }
});
