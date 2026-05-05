const fs = require('fs');
const content = fs.readFileSync('admin.js', 'utf8');
const lines = content.split('\n');
for (let i = 5635; i < 5645; i++) {
    console.log(i + ': ' + JSON.stringify(lines[i]));
}
