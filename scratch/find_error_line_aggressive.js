const fs = require('fs');
const { execSync } = require('child_process');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Try commenting out blocks of 100 lines
for (let i = 0; i < lines.length; i += 100) {
    const subset = [...lines];
    for (let j = i; j < Math.min(i + 100, lines.length); j++) {
        subset[j] = '// ' + subset[j];
    }
    fs.writeFileSync('temp_check.js', subset.join('\n'));
    try {
        execSync('node --check temp_check.js', { stdio: 'ignore' });
        console.log(`Error is in the block starting at line ${i + 1}`);
        // Now find the exact line
        for (let k = i; k < Math.min(i + 100, lines.length); k++) {
             const sub2 = [...lines];
             sub2[k] = '// ' + sub2[k];
             fs.writeFileSync('temp_check.js', sub2.join('\n'));
             try {
                 execSync('node --check temp_check.js', { stdio: 'ignore' });
                 console.log(`Exact error line is ${k + 1}: ${lines[k].trim()}`);
                 process.exit(0);
             } catch (e) {}
        }
    } catch (e) {}
}
