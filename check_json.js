const fs = require('fs');
try {
    const content = fs.readFileSync('data.js', 'utf8');
    // Remove 'window.FULL_DATA = ' and ';'
    const jsonStr = content.replace(/^window\.FULL_DATA\s*=\s*/, '').replace(/;?\s*$/, '');
    JSON.parse(jsonStr);
    console.log('Valid JSON');
} catch (e) {
    console.error('Invalid JSON:', e.message);
}
