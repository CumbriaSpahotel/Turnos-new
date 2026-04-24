const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const filePath = path.join(repoRoot, 'admin.js');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Borramos el bloque huérfano entre 2205 y 2276 (aproximadamente)
// Buscamos 'const initials = name.split'
const startIndex = lines.findIndex(l => l.includes('const initials = name.split'));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.trim() === '};' && lines[i-1].includes('`;'));

if (startIndex !== -1 && endIndex !== -1) {
    console.log(`Borrando bloque huérfano: ${startIndex + 1} a ${endIndex + 1}`);
    lines.splice(startIndex, endIndex - startIndex + 1);
}

// También buscamos el otro bloque huérfano (el que estaba en 2568)
const startIndex2 = lines.findIndex(l => l.includes('const next7 = line.history.filter'));
const endIndex2 = lines.findIndex((l, i) => i > startIndex2 && l.trim() === '};' && lines[i-1].includes('`;'));

if (startIndex2 !== -1 && endIndex2 !== -1) {
    console.log(`Borrando segundo bloque huérfano: ${startIndex2 + 1} a ${endIndex2 + 1}`);
    lines.splice(startIndex2 - 5, endIndex2 - startIndex2 + 6); // Un poco más para limpiar el inicio del drawer
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Limpieza quirúrgica completada.');
