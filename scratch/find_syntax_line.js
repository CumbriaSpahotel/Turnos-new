const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 100; i < lines.length; i += 100) {
    const subset = lines.slice(0, i).join('\n');
    try {
        new Function(subset);
    } catch (e) {
        if (e.message.includes('Unexpected end of input')) continue;
        console.log(`Syntax error at/before line ${i}: ${e.message}`);
        // Binary search within this block
        for(let j = i-100; j < i; j++) {
            try {
                new Function(lines.slice(0, j).join('\n'));
            } catch (e2) {
                 if (e2.message.includes('Unexpected end of input')) continue;
                 console.log(`First hard syntax error at line ${j}: ${e2.message}`);
                 break;
            }
        }
        break;
    }
}
