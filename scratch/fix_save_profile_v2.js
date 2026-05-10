const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// Find the corrupted saveEmployeeProfileV2 line
const regex = /\/\/ .+? \.saveEmployeeProfileV2 = async \(event\) => \{/;
const fixedLine = `window.saveEmployeeProfileV2 = async (event) => {`;

if (regex.test(content)) {
    content = content.replace(regex, fixedLine);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed saveEmployeeProfileV2 definition.');
} else {
    console.log('Corrupted saveEmployeeProfileV2 line not found.');
}
