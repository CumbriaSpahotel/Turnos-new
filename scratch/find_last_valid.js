const fs = require('fs');
const { execSync } = require('child_process');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = lines.length; i > 0; i -= 10) {
    const subset = lines.slice(0, i).join('\n');
    fs.writeFileSync('temp_check.js', subset);
    try {
        execSync('node --check temp_check.js', { stdio: 'ignore' });
        console.log(`File is valid up to line ${i}`);
        break;
    } catch (e) {
        // Continue
    }
}
