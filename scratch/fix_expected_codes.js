const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\/.*?=\s*\{\s*'VAC':\s*'VAC',\s*'BAJA':\s*'BAJA',\s*'PERMISO':\s*'PERM',\s*'PERM':\s*'PERM'\s*\};\s*const expected = expectedCodes\[tipoEv\];/;

const newText = `// Codigos esperados restaurados
                        const expectedCodes = { 'VAC': 'VAC', 'BAJA': 'BAJA', 'PERMISO': 'PERM', 'PERM': 'PERM' };
                        const expected = expectedCodes[tipoEv];`;

content = content.replace(regex, newText);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed expectedCodes error.');
