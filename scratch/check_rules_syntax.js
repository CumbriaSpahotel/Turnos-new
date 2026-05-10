const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\turnos-rules.js';
const content = fs.readFileSync(path, 'utf8');

try {
    new Function(content);
    console.log('Syntax OK');
} catch (e) {
    console.error('Syntax Error:', e.message);
    // Try to find the line number
    const match = e.stack.match(/<anonymous>:(\d+):(\d+)/);
    if (match) {
        console.log(`Error at line ${match[1]}, column ${match[2]}`);
    } else {
        // Fallback for some Node versions
        console.log(e.stack);
    }
}
