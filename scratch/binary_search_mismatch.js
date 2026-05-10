const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

function check(n) {
    const subset = lines.slice(0, n).join('\n');
    let braces = 0;
    let inString = null;
    let inComment = null;
    for (let i = 0; i < subset.length; i++) {
        const c = subset[i]; const next = subset[i+1];
        if (inComment === 'line') { if (c === '\n') inComment = null; continue; }
        if (inComment === 'block') { if (c === '*' && next === '/') { inComment = null; i++; } continue; }
        if (inString) { if (c === '\\') { i++; continue; } if (c === inString) inString = null; continue; }
        if (c === '/' && next === '/') { inComment = 'line'; i++; continue; }
        if (c === '/' && next === '*') { inComment = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
        if (c === '{') braces++;
        if (c === '}') braces--;
    }
    return braces === 0;
}

let low = 1, high = lines.length;
let lastBalanced = 1;
while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    if (check(mid)) {
        lastBalanced = mid;
        low = mid + 1;
    } else {
        high = mid - 1;
    }
}

console.log(`Last balanced line: ${lastBalanced}`);
console.log(`Mismatch starts around line ${lastBalanced + 1}`);
console.log(`Line ${lastBalanced + 1}: ${lines[lastBalanced].trim()}`);
