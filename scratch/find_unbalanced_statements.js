const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

lines.forEach((line, i) => {
    let parens = 0;
    for (let c of line) {
        if (c === '(') parens++;
        if (c === ')') parens--;
    }
    if (parens !== 0) {
        // Many lines are unbalanced (like function starts)
        // But if a line ends with ; and is unbalanced, that's suspicious
        if (line.trim().endsWith(';') || line.trim().endsWith(',')) {
             console.log(`L${i+1}: ${line.trim()}`);
        }
    }
});
