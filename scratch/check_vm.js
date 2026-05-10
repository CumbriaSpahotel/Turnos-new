const fs = require('fs');
const vm = require('vm');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

try {
    new vm.Script(content);
    console.log('Script is valid.');
} catch (e) {
    console.log(`Error: ${e.message}`);
    // If it's Unexpected end of input, we need to find what's open.
    // We can do this by checking subsets.
}
