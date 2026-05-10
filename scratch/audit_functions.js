const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

const assignments = [];
const regex = /window\.([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(\([^)]*\)|[a-zA-Z0-9_]+)\s*=>\s*\{/g;
let match;
while ((match = regex.exec(content)) !== null) {
    assignments.push({ name: match[1], index: match.index });
}

assignments.forEach((assign, i) => {
    const nextIndex = assignments[i+1] ? assignments[i+1].index : content.length;
    const section = content.substring(assign.index, nextIndex);
    
    let braces = 0;
    let inString = null;
    let inComment = null;
    for (let j = 0; j < section.length; j++) {
        const c = section[j];
        const next = section[j+1];
        if (inComment === 'line') { if (c === '\n') inComment = null; continue; }
        if (inComment === 'block') { if (c === '*' && next === '/') { inComment = null; j++; } continue; }
        if (inString) { if (c === '\\') { j++; continue; } if (c === inString) inString = null; continue; }
        if (c === '/' && next === '/') { inComment = 'line'; j++; continue; }
        if (c === '/' && next === '*') { inComment = 'block'; j++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
        
        if (c === '{') braces++;
        if (c === '}') braces--;
    }
    if (braces !== 0) {
        console.log(`Function window.${assign.name} (starting at index ${assign.index}) is UNBALANCED: ${braces}`);
    }
});
