
const fs = require('fs');
const content = fs.readFileSync('admin.js', 'utf8');
let stack = [];
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') stack.push({ line: i + 1, col: j + 1 });
        else if (line[j] === '}') {
            if (stack.length === 0) console.log('Extra } at line ' + (i + 1));
            else stack.pop();
        }
    }
}
if (stack.length > 0) {
    console.log('Unclosed { at:');
    stack.forEach(s => console.log('Line ' + s.line + ', Col ' + s.col));
}
