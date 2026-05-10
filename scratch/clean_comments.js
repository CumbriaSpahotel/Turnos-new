const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
const content = fs.readFileSync(path, 'utf8');

// Remove single line comments that might have merged code
// But be careful not to remove URLs or other things.
// A safe way is to look for // and remove until end of line.
const lines = content.split('\n');
const cleanedLines = lines.map(line => {
    // Only remove // if it's not inside a string.
    // For simplicity, just remove if it's not preceded by : (like http://)
    if (line.includes('//') && !line.includes('://')) {
        return line.split('//')[0];
    }
    return line;
});

fs.writeFileSync('c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin_clean.js', cleanedLines.join('\n'), 'utf8');
console.log('Cleaned file created.');
