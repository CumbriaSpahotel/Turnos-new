
const fs = require('fs');
const content = fs.readFileSync('admin.js', 'utf8');
let stack = [];
let lines = content.split('\n');
let showPublishPreviewLine = -1;
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes('window.showPublishPreview =')) {
        showPublishPreviewLine = i + 1;
        console.log('Found showPublishPreview at line ' + (i + 1) + '. Current stack depth: ' + stack.length);
    }
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') stack.push(i + 1);
        else if (line[j] === '}') {
            stack.pop();
        }
    }
}
