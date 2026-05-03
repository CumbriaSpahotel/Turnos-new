const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// Buscamos el inicio del bloque
const startMarker = '// ==========================================';
const subMarker = 'MÓDULO: CAMBIOS DE TURNO';
const endMarker = '};'; // El final de anularChange

// Vamos a usar una estrategia de búsqueda por líneas para ser precisos
const lines = content.split(/\r?\n/);
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// ==========================================') && 
        lines[i+1] && lines[i+1].includes('CAMBIOS DE TURNO')) {
        startLine = i;
        break;
    }
}

if (startLine !== -1) {
    // Buscamos el final del bloque (la última línea de anularChange)
    for (let i = startLine; i < lines.length; i++) {
        if (lines[i].includes('window.anularChange = async (id) => {')) {
            // Buscamos el cierre de esta función
            let braces = 0;
            let foundStart = false;
            for (let j = i; j < lines.length; j++) {
                if (lines[j].includes('{')) { braces++; foundStart = true; }
                if (lines[j].includes('}')) { braces--; }
                if (foundStart && braces === 0) {
                    endLine = j;
                    break;
                }
            }
            break;
        }
    }
}

if (startLine !== -1 && endLine !== -1) {
    console.log(`Replacing lines ${startLine + 1} to ${endLine + 1}`);
    const replacement = [
        '// ==========================================',
        '// MÓDULO: CAMBIOS DE TURNO (MIGRADO A cambios-module.js)',
        '// ==========================================',
        'window.initChangesControls = () => window.CambiosModule.init();',
        'window.renderChanges = () => window.CambiosModule.renderChanges();',
        'window.editChange = (id) => window.CambiosModule.editChange(id);',
        'window.saveChangeEdit = (e) => window.CambiosModule.saveChangeEdit(e);',
        'window.anularChange = (id) => window.CambiosModule.anularChange(id);',
        'window.closeChangeEditModal = () => window.CambiosModule.closeChangeEditModal();'
    ];
    
    lines.splice(startLine, endLine - startLine + 1, ...replacement);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('Successfully updated admin.js');
} else {
    console.error('Could not find the target block in admin.js');
    console.log('startLine:', startLine);
    console.log('endLine:', endLine);
}
