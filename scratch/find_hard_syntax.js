const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

let current = '';
for (let i = 0; i < lines.length; i++) {
    current += lines[i] + '\n';
    try {
        new Function(current);
        // If we reach here, the block is complete and valid.
        current = ''; 
    } catch (e) {
        if (e.message.includes('Unexpected end of input')) {
            // Still in an open block, keep appending.
            continue;
        }
        console.log(`HARD SYNTAX ERROR at line ${i + 1}: ${e.message}`);
        console.log(`Line content: ${lines[i].trim()}`);
        // Log previous lines for context
        for(let k=Math.max(0, i-5); k<=i; k++) {
            console.log(`${k+1}: ${lines[k]}`);
        }
        process.exit(0);
    }
}
console.log('No hard syntax errors found.');
