const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 1; i <= lines.length; i++) {
    const subset = lines.slice(0, i).join('\n');
    try {
        // Use a simple check: can we parse it if we close all open blocks?
        // (This is hard to implement perfectly)
        // Let's just use node --check on a temp file
        fs.writeFileSync('temp_check.js', subset + '\n'.repeat(100) + '} ) ]'.repeat(20));
        require('child_process').execSync('node --check temp_check.js');
    } catch (e) {
        console.log(`First syntax error at line ${i}`);
        console.log(lines[i-1]);
        process.exit(0);
    }
}
