const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic line has a specific signature
const corruptedLine = /\/\/ 3\. Turnos inv—\.row\.values\.forEach\(\(v, idx\) => \{/;
const fix = `// 3. Turnos inválidos
        if (c.row && c.row.values) {
            c.row.values.forEach((v, idx) => {`;

if (corruptedLine.test(content)) {
    content = content.replace(corruptedLine, fix);
    
    // Also clean up the check inside the loop which might be corrupted too
    const innerCheck = /if \(vNorm && !validShifts\.has\(vNorm\) && !vNorm\.includes\('[^']+'\)\) \{/;
    content = content.replace(innerCheck, "if (vNorm && !validShifts.has(vNorm)) {");
    
    fs.writeFileSync(path, content, 'utf8');
    console.log('Syntax error fixed via script.');
} else {
    console.log('Corrupted line not found via regex.');
}
