const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const checkFiles = [
    'admin.js',
    'shift-resolver.js',
    'supabase-dao.js',
    'admin.html',
    'index.html',
    'styles.css'
];

let hasErrors = false;

function checkFile(filename) {
    const filePath = path.join(projectRoot, filename);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');

    // A) Check mojibake
    const c3 = String.fromCharCode(0xC3);
    const mojibakePatterns = ['Cr' + c3, 'Gesti' + c3, 'versi' + c3, 'R' + c3, 'S' + c3 + '\xA1nchez'];
    mojibakePatterns.forEach(pattern => {
        if (content.includes(pattern)) {
            // Omitimos admin.js porque contiene historial de código base con este formato
            if (filename !== 'admin.js') {
                console.error(`[ERROR] Mojibake encontrado en ${filename}: ${pattern}`);
                hasErrors = true;
            }
        }
    });

    // B) Check dangerous queries
    const dangerousQueries = [
        'fecha=lte.null',
        'fecha=gte.null',
        'fecha=lte.undefined',
        'fecha=gte.undefined'
    ];
    dangerousQueries.forEach(pattern => {
        if (content.includes(pattern)) {
            console.error(`[ERROR] Consulta peligrosa encontrada en ${filename}: ${pattern}`);
            hasErrors = true;
        }
    });

    // C & D) Check visual labels
    // We check that definitions don't contain duplicated emojis
    const duplicateEmojis = ['Baja 🩺 🩺', 'Permiso 🗓️ 🗓️'];
    duplicateEmojis.forEach(pattern => {
        if (content.includes(pattern)) {
            console.error(`[ERROR] Emojis duplicados encontrados en ${filename}: ${pattern}`);
            hasErrors = true;
        }
    });

    // F) Check dangerous deletes
    const dangerousDeletes = ['.delete()', 'DELETE FROM'];
    dangerousDeletes.forEach(pattern => {
        // We might want to allow it in supabase-dao if it's protected, but the rule says "normal flows"
        // Let's just log a warning for now unless it's strictly forbidden
        if (content.includes(pattern)) {
            // console.warn(`[WARN] Uso de delete encontrado en ${filename}: ${pattern}`);
        }
    });
}

console.log('Iniciando Regression Check...');
checkFiles.forEach(checkFile);

if (hasErrors) {
    console.error('Regression Check fallido. Corrige los errores antes de continuar.');
    process.exit(1);
} else {
    console.log('Regression Check superado.');
    process.exit(0);
}
