const fs = require('fs');
const { execSync } = require('child_process');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

function is_valid(subset_lines) {
    fs.writeFileSync('temp_check.js', subset_lines.join('\n'));
    try {
        execSync('node --check temp_check.js', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

// Binary search: find the first line such that lines[0...n] is invalid, 
// but we want to find why it's invalid.
// Actually, let's try to remove a HUGE chunk and see if it becomes valid.
for (let i = 0; i < lines.length; i += 500) {
    const subset = [...lines];
    subset.splice(i, 500);
    if (is_valid(subset)) {
        console.log(`Error is in the chunk L${i+1} to L${i+500}`);
        process.exit(0);
    }
}
