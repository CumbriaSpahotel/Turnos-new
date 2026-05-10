const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\turnos-rules.js';
let content = fs.readFileSync(path, 'utf8');

const target = `        // REGLA MAESTRA 📌: Solo si shouldShowPinSustitucion es true
        if (shouldShowPinSustitucion(cell, employee, context)) {
            icons.add('\\u{1F4CC}');
        } else {
            // Saneamiento de seguridad: si se coló un 📌 por error, lo quitamos
            icons.delete('\\u{1F4CC}');
            icons.delete('📌');
        }`;

const replacement = `        // REGLA MAESTRA 📌: Solo si shouldShowPinSustitucion es true 
        // O si ya venía en los iconos explícitos del snapshot (confianza en la persistencia)
        const hasPinInSnapshot = explicitIcons.includes('\\u{1F4CC}') || explicitIcons.includes('📌');
        if (shouldShowPinSustitucion(cell, employee, context) || hasPinInSnapshot) {
            icons.add('\\u{1F4CC}');
        } else {
            // Saneamiento de seguridad: si se coló un 📌 por error y NO estaba en el snapshot, lo quitamos
            icons.delete('\\u{1F4CC}');
            icons.delete('📌');
        }`;

// Use flexible replacement for line endings
const escapeRegex = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const targetRegex = new RegExp(escapeRegex(target).replace(/\\ /g, ' *').replace(/\\n/g, '\\r?\\n'), 'g');

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated turnos-rules.js');
} else {
    console.log('Target content not found in turnos-rules.js');
}
