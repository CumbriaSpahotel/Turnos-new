/**
 * Full mojibake audit across ALL source files in the project
 */
const fs = require('fs');
const path = require('path');

const FILES = [
    'admin.js', 'admin.html', 'shift-resolver.js', 'supabase-dao.js',
    'index.html', 'live.mobile.html', 'mobile.app.js',
    'bajas-module.js', 'vacaciones-module.js', 'sync-gaps.js',
    'cambios-module.js', 'turnos-rules.js', 'turnos-engine.js',
    'excel-loader.js', 'sync-status.js', 'solicitud.html',
    'solicitudes.html', 'styles.css', 'styles.mobile.css'
];

// Must NOT flag these: ñ, ó, á, é, í, ú, Ñ, Ó, Á, É, Ú, Í, ü, ¿, ¡, ←→, emojis
// MUST flag: double-encoded sequences like Ã±, Ã³, â€, etc.
// Only flag patterns that are clearly corrupted (multi-byte sequences misread)
const MOJIBAKE_RE = /Ã[ƒÂ‚±©³¡°¼¨½]/u
    || /â€[™"œž•…–—]/u
    || /\u00c3[\u0192\u00c2\u00b1\u00a9\u00b3\u00a1\u00b0\u00bc\u00a8\u00bd]/
    || /\u00e2\u0082\u00ac/;

// Simple check using regex patterns that avoid valid chars
function hasMojibake(line) {
    // Check for the classic double-UTF8 encoding patterns
    return /\u00c3[\u00a1-\u00ba\u0081-\u009a]/.test(line) ||  // Ã + accented char byte
           /\u00c3\u0192/.test(line) ||  // Ãƒ
           /\u00c3\u00c2/.test(line) ||  // ÃÂ
           /\u00e2\u0082/.test(line) ||  // â€
           /\u00c2\u00b0/.test(line) ||  // Â°
           /\u00c2\u00b7/.test(line) ||  // Â·
           /\uFFFD/.test(line);          // replacement char
}

let total = 0;
FILES.forEach(f => {
    if (!fs.existsSync(f)) return;
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    const hits = [];
    lines.forEach((line, i) => {
        if (hasMojibake(line)) {
            hits.push({ line: i + 1, text: line.substring(0, 120).trim() });
        }
    });
    if (hits.length) {
        console.log(`\n=== ${f} (${hits.length} lines) ===`);
        hits.slice(0, 10).forEach(h => console.log(`  L${h.line}: ${h.text}`));
        if (hits.length > 10) console.log(`  ... and ${hits.length - 10} more`);
        total += hits.length;
    }
});
console.log(`\nTOTAL MOJIBAKE LINES: ${total}`);
