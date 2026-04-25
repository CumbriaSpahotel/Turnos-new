const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split(/\r?\n/);
// We want to remove lines 744 to 769 (1-indexed)
// Index in array is 743 to 768
const filtered = lines.filter((_, i) => (i + 1) < 744 || (i + 1) > 769);
fs.writeFileSync('index.html', filtered.join('\n'));
console.log('Fixed index.html');
