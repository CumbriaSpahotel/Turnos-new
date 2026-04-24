const fs = require('fs');
const path = require('path');

// El archivo está en la raíz del repo
const repoRoot = path.resolve(__dirname, '../../..');
const filePath = path.join(repoRoot, 'admin.js');

if (!fs.existsSync(filePath)) {
    console.error(`No existe admin.js en ${filePath}`);
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

const startMarker = 'const _unused_createPuestosPreviewModel = ({';
const endMarker = 'window.buildPuestoCellTitle = (celda) => {';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    fs.writeFileSync(filePath, before + after, 'utf8');
    console.log(`Eliminado bloque desde ${startIndex} hasta ${endIndex}`);
} else {
    console.log('No se encontró el bloque para eliminar', { startIndex, endIndex });
}
