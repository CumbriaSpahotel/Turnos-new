const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const filePath = path.join(repoRoot, 'admin.js');
let content = fs.readFileSync(filePath, 'utf8');

// Buscamos todas las ocurrencias de window.openEmpDrawer =
const regex = /window\.openEmpDrawer\s*=\s*\((?:idOrName|name|id)\)\s*=>\s*\{[\s\S]*?\};/g;
let match;
const matches = [];
while ((match = regex.exec(content)) !== null) {
    matches.push({ index: match.index, length: match[0].length, content: match[0] });
}

console.log(`Encontradas ${matches.length} definiciones de openEmpDrawer`);

// Queremos mantener SOLO la primera (que es la que está en la sección de la ficha arriba)
// Pero espera, ¿cuál es la buena? La que está en la línea 690.
// Vamos a filtrar las que NO están en la línea 690 (aproximadamente).

const goodIndex = content.indexOf('window.openEmpDrawer = (idOrName) => {');
console.log(`Índice de la buena: ${goodIndex}`);

const toDelete = matches.filter(m => Math.abs(m.index - goodIndex) > 100);

// Borramos de atrás hacia adelante para no romper los índices
toDelete.sort((a, b) => b.index - a.index).forEach(m => {
    console.log(`Borrando duplicado en índice ${m.index}`);
    content = content.substring(0, m.index) + content.substring(m.index + m.length);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Limpieza completada.');
