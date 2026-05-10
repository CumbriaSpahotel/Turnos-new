// Decode: c3 a2 e2 82 ac e2 80 9d
// These are the actual bytes for: â€™ (smart right quote triple-encoded)
// c3 a2 = U+00E2 = â (byte e2 from em-dash encoded again as UTF-8)
// e2 82 ac = U+20AC = € ... wait this doesn't seem right

// Let me think differently. The git commit has these bytes in the source.
// This means the FILE WAS ALREADY CORRUPTED in the git repository.
// The corruption was ALREADY THERE before our changes.
// Our changes added MORE corruption on top.

// The right approach: the file in git already had single-layer mojibake
// (originally stored as UTF-8, but some strings were double-encoded).
// Our powershell scripts added another layer.

// Strategy: fix the git file in-place by replacing corrupted sequences with proper UTF-8.

const fs = require('fs');
let content = fs.readFileSync('admin.js', 'utf8');

// Remove BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
}

// These are the replacement mappings for common mojibake patterns
// Pattern: what appears in the source (double/triple UTF-8 encoded) -> correct UTF-8 string
const FIXES = [
    // Triple-encoded (what git has) -> correct char
    // em-dash U+2014 (three bytes: e2 80 94) triple-encoded
    // Each byte b re-encoded: b -> UTF-8(b as latin-1 codepoint)
    // e2 (226) -> c3 a2, 80 (128) -> c2 80, 94 (148) -> c2 94
    // but that gives c3a2 c280 c294, not what we see
    
    // What we see: c3 a2 e2 82 ac e2 80 9d
    // Reading as UTF-8: U+00E2, U+20AC, U+201D
    // U+00E2 = â, U+20AC = €, U+201D = right double quote "
    // This looks like Windows-1252 interpretation of UTF-8 em-dash e2 80 94:
    // e2 = â in cp1252
    // 80 = € in cp1252 (special mapping)  
    // 94 = " in cp1252 (special mapping - right double quote U+201D)
    // Then THAT Windows-1252 text was stored as UTF-8, giving:
    // â = U+00E2 -> UTF-8: c3 a2
    // € = U+20AC -> UTF-8: e2 82 ac
    // " = U+201D -> UTF-8: e2 80 9d
    // CONFIRMED: triple encoding via Windows-1252 misinterpretation!
    
    // So to fix: 
    // c3 a2 e2 82 ac e2 80 94 -> e2 80 94 (em-dash)
    ['\u00e2\u20ac\u201d', '\u2014'], // â€" -> — (em dash)
    ['\u00e2\u20ac\u201c', '\u2013'], // â€" -> – (en dash)
    ['\u00e2\u20ac\u2122', '\u2019'], // â€™ -> ' (right single quote)
    ['\u00e2\u20ac\u0153', '\u201c'], // â€œ -> " (left double quote)
    ['\u00e2\u20ac', '\u20ac'],       // â€ alone -> € (fallback)
    ['\u00e2\u0086\u0094', '\u2194'], // â†" -> ↔ (left-right arrow)
    ['\u00e2\u0086\u0092', '\u2192'], // â†' -> → (right arrow)
    
    // Double-encoded accented chars (cp1252 -> UTF-8 of cp1252 codes)
    ['\u00c3\u00b3', '\u00f3'],  // Ã³ -> ó
    ['\u00c3\u00b1', '\u00f1'],  // Ã± -> ñ
    ['\u00c3\u00a1', '\u00e1'],  // Ã¡ -> á
    ['\u00c3\u00a9', '\u00e9'],  // Ã© -> é
    ['\u00c3\u00ba', '\u00fa'],  // Ãº -> ú
    ['\u00c3\u00ad', '\u00ed'],  // Ã­ -> í
    ['\u00c3\u00bc', '\u00fc'],  // Ã¼ -> ü
    ['\u00c3\u0093', '\u00d3'],  // Ã" -> Ó
    ['\u00c3\u0091', '\u00d1'],  // Ã' -> Ñ
    ['\u00c3\u0081', '\u00c1'],  // Ã -> Á
    ['\u00c3\u0089', '\u00c9'],  // Ã‰ -> É
    ['\u00c3\u009a', '\u00da'],  // Ãš -> Ú
    ['\u00c3\u008d', '\u00cd'],  // Ã -> Í
    ['\u00c3\u00bf', '\u00ff'],  // Ã¿ -> ÿ
    
    // Single-byte Windows special chars sometimes double-encoded
    ['\u00c2\u00b0', '\u00b0'],  // Â° -> °
    ['\u00c2\u00ba', '\u00ba'],  // Âº -> º
    ['\u00c2\u00aa', '\u00aa'],  // Âª -> ª  
    ['\u00c2\u00b7', '\u00b7'],  // Â· -> ·
];

let totalFixed = 0;
FIXES.forEach(([from, to]) => {
    const count = (content.split(from).length - 1);
    if (count > 0) {
        content = content.split(from).join(to);
        console.log(`Fixed ${count}x: ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
        totalFixed += count;
    }
});

// Save as UTF-8 without BOM
fs.writeFileSync('admin.js', content, 'utf8');
console.log(`\nTotal fixes: ${totalFixed}`);
console.log('File saved as UTF-8 (no BOM)');
