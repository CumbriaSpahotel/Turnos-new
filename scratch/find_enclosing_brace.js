
const fs = require('fs');
const content = fs.readFileSync('admin.js', 'utf8');
let stack = [];
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes('window.showPublishPreview =')) {
        console.log('Found showPublishPreview at line ' + (i + 1));
        console.log('Open braces stack:', stack);
    }
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') stack.push({ line: i + 1, col: j + 1 });
        else if (line[j] === '}') {
            stack.pop();
        }
    }
}
