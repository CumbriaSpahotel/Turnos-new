const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('//') && line.includes('=') && !line.includes('://')) {
        const commentPart = line.split('//')[1];
        if (commentPart.includes('=') && /[a-zA-Z0-9_$]+ *=/.test(commentPart)) {
             console.log(`L${i+1}: ${line.trim()}`);
        }
    }
}
