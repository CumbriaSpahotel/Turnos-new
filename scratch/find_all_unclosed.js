const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

const stack = [];
for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '(') stack.push({ type: '(', pos: i });
    if (c === ')') stack.pop();
    if (c === '{') stack.push({ type: '{', pos: i });
    if (c === '}') stack.pop();
    if (c === '[') stack.push({ type: '[', pos: i });
    if (c === ']') stack.pop();
}

stack.forEach(s => {
    const line = content.substring(0, s.pos).split('\n').length;
    console.log(`Unclosed ${s.type} at line ${line}`);
});
