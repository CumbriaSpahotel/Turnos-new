const fs = require('fs');
const vm = require('vm');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\turnos-rules.js';
const content = fs.readFileSync(path, 'utf8');

try {
    const script = new vm.Script(content, { filename: 'turnos-rules.js' });
    console.log('Syntax OK');
} catch (e) {
    console.error('Syntax Error in turnos-rules.js:');
    console.error(e.message);
    console.error(e.stack);
}
