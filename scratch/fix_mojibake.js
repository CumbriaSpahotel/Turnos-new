// Fix mojibake sequences in admin.js
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'admin.js');

let content = fs.readFileSync(filePath, 'utf8');
const before = content.length;

// Map of mojibake sequences to correct Unicode
const fixes = [
    // em-dash: UTF-8 bytes E2 80 94 misread as latin-1/cp1252
    ['â€"', '\u2014'],   // —
    // right single quote: E2 80 99
    ["â€\u2122", '\u2019'], // '
    // left double quote: E2 80 9C
    ["â€\u0153", '\u201C'], // "
    // right double quote: E2 80 9D
    ["â€\u009D", '\u201D'], // "
    // ellipsis: E2 80 A6
    ["â€¦", '\u2026'],   // …
    // Common Spanish accents misread:
    // ó: C3 B3
    ['\u00C3\u00B3', '\u00F3'],
    // é: C3 A9
    ['\u00C3\u00A9', '\u00E9'],
    // í: C3 AD
    ['\u00C3\u00AD', '\u00ED'],
    // á: C3 A1
    ['\u00C3\u00A1', '\u00E1'],
    // ú: C3 BA
    ['\u00C3\u00BA', '\u00FA'],
    // ñ: C3 B1
    ['\u00C3\u00B1', '\u00F1'],
    // ü: C3 BC
    ['\u00C3\u00BC', '\u00FC'],
    // Ó: C3 93
    ['\u00C3\u0093', '\u00D3'],
    // É: C3 89
    ['\u00C3\u0089', '\u00C9'],
];

let count = 0;
for (const [bad, good] of fixes) {
    const occurrences = (content.split(bad).length - 1);
    if (occurrences > 0) {
        content = content.split(bad).join(good);
        count += occurrences;
        console.log(`Fixed ${occurrences}x "${bad}" -> "${good}"`);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Done. Total fixes: ${count}. Length: ${before} -> ${content.length}`);
