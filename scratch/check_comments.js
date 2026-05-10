const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

let inComment = false;
let lastCommentLine = 0;

for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i+1];
    if (inComment) {
        if (c === '*' && next === '/') { inComment = false; i++; }
    } else {
        if (c === '/' && next === '*') {
            inComment = true;
            lastCommentLine = content.substring(0, i).split('\n').length;
            i++;
        }
    }
}

if (inComment) {
    console.log(`Unclosed block comment starting at line ${lastCommentLine}`);
} else {
    console.log('All block comments closed.');
}
