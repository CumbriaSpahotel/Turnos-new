const fs = require('fs');
const { execSync } = require('child_process');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

function check(n) {
    const subset = lines.slice(0, n).join('\n');
    fs.writeFileSync('temp_check.js', subset);
    try {
        execSync('node --check temp_check.js', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

let low = 1, high = lines.length;
let lastValid = 0;
while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    if (check(mid)) {
        lastValid = mid;
        low = mid + 1;
    } else {
        high = mid - 1;
    }
}

console.log(`Last valid line: ${lastValid}`);
if (lastValid < lines.length) {
    console.log(`First error at line ${lastValid + 1}: ${lines[lastValid].trim()}`);
    // Run node --check on the failing subset to get the error message
    fs.writeFileSync('temp_check.js', lines.slice(0, lastValid + 1).join('\n'));
    try {
        execSync('node --check temp_check.js');
    } catch (e) {
        console.log(e.stderr.toString());
    }
}
