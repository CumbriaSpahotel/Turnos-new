const fs = require('fs');
const content = fs.readFileSync('admin.js', 'utf8');
const lines = content.split('\n');

// Encontrar la segunda ocurrencia de window.publishToSupabase
let count = 0;
let startIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('window.publishToSupabase = async () =>')) {
        count++;
        if (count === 2) {
            startIndex = i;
            break;
        }
    }
}

if (startIndex !== -1) {
    console.log(`Found duplicate at line ${startIndex + 1}`);
    // Encontrar el cierre de la función (aproximado buscando }; solo en una línea)
    let endIndex = -1;
    for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].trim() === '};' && (i === lines.length - 1 || lines[i+1].trim() === '' || lines[i+1].includes('//') || lines[i+1].includes('window.'))) {
             // Verificamos que no sea el cierre de un bloque interno
             // En este caso, la función legacy termina cerca de donde empieza la sección 13.
             if (lines[i+1] && lines[i+1].includes('REAL-TIME')) {
                 endIndex = i;
                 break;
             }
             // Fallback: buscar la siguiente sección
             if (lines[i+1] && lines[i+1].includes('// ==========================================')) {
                 endIndex = i;
                 break;
             }
        }
    }

    if (endIndex !== -1) {
        console.log(`Deleting lines ${startIndex + 1} to ${endIndex + 1}`);
        lines.splice(startIndex, endIndex - startIndex + 1, '// Duplicate legacy publishToSupabase removed');
        fs.writeFileSync('admin.js', lines.join('\n'), 'utf8');
        console.log('Success!');
    } else {
        console.log('Could not find end of function');
        // Deletrear los próximos 275 líneas si no encontramos el fin (basado en mi view_file previo)
        lines.splice(startIndex, 276, '// Duplicate legacy publishToSupabase removed (forced)');
        fs.writeFileSync('admin.js', lines.join('\n'), 'utf8');
        console.log('Success (forced)!');
    }
} else {
    console.log('Duplicate not found');
}
