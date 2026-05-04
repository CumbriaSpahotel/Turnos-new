const fs = require('fs');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    const replacements = [
        // UTF-8 patterns seen in admin.js
        [/ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ/g, 'Ó'],
        [/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº/g, 'ú'],
        [/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³/g, 'ó'],
        [/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­/g, 'í'],
        [/ÃƒÆ’Ã‚Â±/g, 'ñ'],
        [/ÃƒÆ’Ã‚Â¡/g, 'á'],
        [/ÃƒÆ’Ã‚Â©/g, 'é'],
        [/ÃƒÆ’Ã‚Â­/g, 'í'],
        [/ÃƒÆ’Ã‚Â³/g, 'ó'],
        [/ÃƒÆ’Ã‚Âº/g, 'ú'],
        [/ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿/g, '?'],
        [/Ãƒâ€šÃ‚Â¿/g, '¿'],
        [/Ãƒâ€šÃ‚Â¡/g, '¡'],
        [/ÃƒÂ³/g, 'ó'],
        [/ÃƒÂ©/g, 'é'],
        [/ÃƒÂ¡/g, 'á'],
        [/ÃƒÂ­/g, 'í'],
        [/ÃƒÂº/g, 'ú'],
        [/Ãƒâ€œ/g, 'Ó'],
        [/Ãƒâ€˜/g, 'Ñ'],
        [/ÃƒÂ±/g, 'ñ'],
        [/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/g, 'ón'],
        [/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³/g, 'ó'],
        [/ÃƒÂ³n/g, 'ón'],
        [/sincronizaciÃ³n/g, 'sincronización'],
        [/producciÃ³n/g, 'producción'],
        [/VERSIÃ³N/g, 'VERSIÓN'],
        [/VersiÃ³n/g, 'Versión'],
        [/publicaciÃ³n/g, 'publicación'],
        [/selecciÃ³n/g, 'selección'],
        [/mÃ³vil/g, 'móvil'],
        [/PÃºblica/g, 'Pública'],
        [/CrÃticos/g, 'Críticos'],
        [/OperaciÃ³n/g, 'Operación'],
        [/ReversiÃ³n/g, 'Reversión'],
        [/Ã©xito/g, 'éxito'],
        [/ÃƒÆ’Ã‚Â¡/g, 'á'],
        [/ÃƒÆ’Ã‚Âºltima/g, 'última'],
        [/ÃƒÆ’Ã‚Âº/g, 'ú']
    ];

    replacements.forEach(([regex, replacement]) => {
        content = content.replace(regex, replacement);
    });

    // Final cleanup of remaining known patterns
    content = content.replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³/g, 'ó');
    content = content.replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³/g, 'ó');
    content = content.replace(/ÃƒÆ’Ã‚Â³/g, 'ó');
    content = content.replace(/ÃƒÂ³/g, 'ó');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Replacements done in ${filePath}`);
}

fixFile('admin.js');
fixFile('admin.html');
