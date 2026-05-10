const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\turnos-rules.js';
let content = fs.readFileSync(path, 'utf8');

const targetLine = "if (shouldShowPinSustitucion(cell, employee, context)) {";
const replacement = `        const hasPinInSnapshot = (Array.isArray(cell?.icons) && (cell.icons.includes('\\u{1F4CC}') || cell.icons.includes('📌')));
        if (shouldShowPinSustitucion(cell, employee, context) || hasPinInSnapshot) {
            icons.add('\\u{1F4CC}');
        } else {
            // Saneamiento de seguridad: si se coló un 📌 por error y NO estaba en el snapshot, lo quitamos
            icons.delete('\\u{1F4CC}');
            icons.delete('📌');
        }`;

if (content.includes(targetLine)) {
    // Find the block
    const startIdx = content.indexOf(targetLine);
    const endIdx = content.indexOf('}', content.indexOf('}', startIdx) + 1) + 1; // Find the outer else block end
    
    // Actually, I'll just match the whole if/else block more safely
    const blockStart = content.lastIndexOf('// REGLA MAESTRA', startIdx);
    const blockEnd = content.indexOf('}', content.indexOf('else {', startIdx)) + 1;
    
    if (blockStart !== -1 && blockEnd !== -1) {
        const finalReplacement = `        // REGLA MAESTRA 📌: Solo si shouldShowPinSustitucion es true 
        // O si ya venía en los iconos explícitos del snapshot (confianza en la persistencia)
${replacement}`;
        content = content.slice(0, blockStart) + finalReplacement + content.slice(blockEnd);
        fs.writeFileSync(path, content, 'utf8');
        console.log('Successfully updated turnos-rules.js');
    }
} else {
    console.log('Target line not found');
}
