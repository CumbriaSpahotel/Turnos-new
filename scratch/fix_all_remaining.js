/**
 * Targeted fix script — no template literal confusion.
 * Fixes:
 * 1. validatePublicationSnapshot: icon check to use cell.icons/flags not cell.code
 * 2. validatePublicationSnapshot: empty-destination → warning not error
 * 3. renderEmpleadoRowHeader: ⚠️ VACANTE emoji
 * 4. renderRequests: add motivo block after date-change grid
 * 5. solicitud.html: mojibake in comments
 */
const fs = require('fs');

// ── admin.js ─────────────────────────────────────────────────────
let adminContent = fs.readFileSync('admin.js', 'utf8');
let fixes = 0;

// FIX 1 — Icon check: use flags not cell.code string
// The bad pattern is: cell.code.includes('🔄') inside validatePublicationSnapshot
// We replace both occurrences with a proper check
const badIconCheck1 = "if (cell && !cell.code.includes('\uD83D\uDD04')) {\n                    errors.push('[BLOQUEO] Intercambio no renderizado (sin icono) para ' + rowOrig.nombreVisible + ' el ' + evStart);\n                }";
const goodIconCheck1 = `if (cell) {
                    const _icons = Array.isArray(cell.icons) ? cell.icons : [];
                    const _hasMarker = cell.changed || cell.intercambio || cell.isModified
                        || _icons.some(i => i === '\\u{1F504}')
                        || (cell._finalState && (cell._finalState.isModified || cell._finalState.icon === '\\u{1F504}'));
                    if (!_hasMarker) {
                        warnings.push('[AVISO] Intercambio no renderizado para ' + (rowOrig.nombreVisible || normEv.origen) + ' el ' + evStart + ' (puede ser solo turno base)');
                    }
                }`;

const badIconCheck2 = "if (cell && !cell.code.includes('\uD83D\uDD04')) {\n                    errors.push('[BLOQUEO] Intercambio no renderizado (sin icono) para ' + rowDest.nombreVisible + ' el ' + evStart);\n                }";
const goodIconCheck2 = `if (cell) {
                    const _icons2 = Array.isArray(cell.icons) ? cell.icons : [];
                    const _hasMarker2 = cell.changed || cell.intercambio || cell.isModified
                        || _icons2.some(i => i === '\\u{1F504}')
                        || (cell._finalState && (cell._finalState.isModified || cell._finalState.icon === '\\u{1F504}'));
                    if (!_hasMarker2) {
                        warnings.push('[AVISO] Intercambio no renderizado para ' + (rowDest.nombreVisible || normEv.destino) + ' el ' + evStart + ' (puede ser solo turno base)');
                    }
                }`;

// Try different newline variants
const variants = [
    ['\n', '\n'],
    ['\r\n', '\r\n'],
    ['\n', '\r\n'],
    ['\r\n', '\n']
];

let found1 = false, found2 = false;

// Search for the broken patterns using indexOf on lines
const lines = adminContent.split('\n');
let newLines = [...lines];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('cell.code.includes') && line.includes('rowOrig')) {
        console.log('[FIX 1a] Found rowOrig icon check at line', i+1, ':', line.trim());
        // Replace lines i-1 through i+2 (the if block)
        newLines[i] = line.replace(
            /if \(cell && !cell\.code\.includes\(['"]\uD83D\uDD04['"]\)\)/,
            "if (cell && !(Array.isArray(cell.icons) && cell.icons.some(x => x === '\u{1F504}')) && !cell.changed && !cell.intercambio && !cell.isModified)"
        ).replace(
            "errors.push('[BLOQUEO] Intercambio no renderizado (sin icono) para ' + rowOrig.nombreVisible + ' el ' + evStart);",
            "warnings.push('[AVISO] Intercambio sin marker 🔄 para ' + (rowOrig.nombreVisible || normEv.origen) + ' el ' + evStart);"
        );
        found1 = true;
        fixes++;
    }
    if (line.includes('cell.code.includes') && line.includes('rowDest')) {
        console.log('[FIX 1b] Found rowDest icon check at line', i+1, ':', line.trim());
        newLines[i] = line.replace(
            /if \(cell && !cell\.code\.includes\(['"]\uD83D\uDD04['"]\)\)/,
            "if (cell && !(Array.isArray(cell.icons) && cell.icons.some(x => x === '\u{1F504}')) && !cell.changed && !cell.intercambio && !cell.isModified)"
        ).replace(
            "errors.push('[BLOQUEO] Intercambio no renderizado (sin icono) para ' + rowDest.nombreVisible + ' el ' + evStart);",
            "warnings.push('[AVISO] Intercambio sin marker 🔄 para ' + (rowDest.nombreVisible || normEv.destino) + ' el ' + evStart);"
        );
        found2 = true;
        fixes++;
    }
}

// Also look for the char U+1F504 stored as literal in different forms
if (!found1) {
    for (let i = 0; i < newLines.length; i++) {
        const l = newLines[i];
        if (l.includes("cell.code.includes('") && (l.includes('rowOrig') || (i > 0 && newLines[i-2] && newLines[i-2].includes('rowOrig')))) {
            console.log('[FIX 1a fallback] Line', i+1, ':', l.trim());
        }
        // Check for the errors.push with BLOQUEO Intercambio no renderizado
        if (l.includes('[BLOQUEO] Intercambio no renderizado') && l.includes('rowOrig.nombreVisible')) {
            console.log('[FIX 1a err line] Found at', i+1);
            newLines[i] = l.replace('[BLOQUEO] Intercambio no renderizado (sin icono)', '[AVISO] Intercambio sin marker')
                           .replace('errors.push(', 'warnings.push(');
            fixes++;
        }
        if (l.includes('[BLOQUEO] Intercambio no renderizado') && l.includes('rowDest.nombreVisible')) {
            console.log('[FIX 1b err line] Found at', i+1);
            newLines[i] = l.replace('[BLOQUEO] Intercambio no renderizado (sin icono)', '[AVISO] Intercambio sin marker')
                           .replace('errors.push(', 'warnings.push(');
            fixes++;
        }
    }
}

adminContent = newLines.join('\n');

// FIX 2 — Empty destination: warning not blocker
const oldEmptyDest = "errors.push('[BLOQUEO] Intercambio de ' + normEv.origen + ' el ' + evStart + ' tiene destino desconocido o vacío. Debe resolverse antes de publicar.');";
const newEmptyDest = "warnings.push('[AVISO] Intercambio de ' + normEv.origen + ' el ' + evStart + ' sin destino definido (cambio unilateral o pendiente de asignar compañero).');";
if (adminContent.includes(oldEmptyDest)) {
    adminContent = adminContent.replace(oldEmptyDest, newEmptyDest);
    console.log('[FIX 2] Empty-destination → warning — OK');
    fixes++;
} else {
    console.warn('[FIX 2] Empty-destination pattern not found — checking BLOQUEO variant');
    const oldAlt = 'tiene destino desconocido o vac\u00edo. Debe resolverse antes de publicar.';
    if (adminContent.includes(oldAlt)) {
        adminContent = adminContent.replace(
            /errors\.push\('[^']*tiene destino desconocido o vac[^']*'\);/,
            "warnings.push('[AVISO] Intercambio de ' + normEv.origen + ' el ' + evStart + ' sin destino definido.');"
        );
        console.log('[FIX 2] Empty-destination → warning (regex) — OK');
        fixes++;
    }
}

// FIX 3 — VACANTE corrupted emoji
// The file should have a line with corrupted warning triangle before VACANTE
const vacanteLine = adminContent.indexOf('VACANTE\u003c/span\u003e');
let vacanteFixed = false;
if (vacanteLine < 0) {
    // Search for the actual VACANTE span
    const vacanteIdx = adminContent.indexOf('VACANTE</span>');
    if (vacanteIdx >= 0) {
        const lineStart = adminContent.lastIndexOf('\n', vacanteIdx);
        const lineEnd = adminContent.indexOf('\n', vacanteIdx);
        const fullLine = adminContent.substring(lineStart + 1, lineEnd);
        console.log('[FIX 3] VACANTE span line:', JSON.stringify(fullLine.trim()));
        // Fix: replace anything before VACANTE</span> that's corrupted
        const fixedLine = fullLine.replace(/[^\x20-\x7E\u00C0-\u024F\u0370-\u03FF\u2000-\u27BF\uD800-\uDFFF\u{1F000}-\u{1FFFF}]*VACANTE<\/span>/u, 
            '\u26A0\uFE0F VACANTE</span>');
        if (fixedLine !== fullLine) {
            adminContent = adminContent.substring(0, lineStart + 1) + fixedLine + adminContent.substring(lineEnd);
            console.log('[FIX 3] VACANTE emoji — OK');
            fixes++;
            vacanteFixed = true;
        } else {
            // Direct search for corrupted bytes
            // ⚠️ = U+26A0 U+FE0F = E2 9A A0 EF B8 8F in UTF-8
            // Corrupted as Windows-1252: â š   ï ¸   -> as UTF-8: c3a2 c29a c2a0 c3af c2b8 c28f
            // But in our case the file shows "âš ï¸" which is the double-encoded form
            // Let's replace it using the actual corrupted character sequence
            const corrupted1 = '\u00e2\u009a\u00a0\u00ef\u00b8\u008f'; // Double-encoded ⚠️
            const corrupted2 = '\u00e2\u009a  '; // Another variant
            if (adminContent.includes(corrupted1)) {
                adminContent = adminContent.replace(corrupted1, '\u26A0\uFE0F');
                console.log('[FIX 3] VACANTE emoji (bytes1) — OK');
                fixes++;
                vacanteFixed = true;
            } else {
                console.warn('[FIX 3] VACANTE corrupted bytes not found — current state may be OK or already fixed');
            }
        }
    }
}

// FIX 4 — renderRequests: add motivo field
// Find the end of the date-change grid rendering and add motivo block
const REQ_GRID_END = "').join('')}\n                    </div>\n                </div>\n            `";
const REQ_GRID_END_CRLF = "').join('')}\r\n                    </div>\r\n                </div>\r\n            `";

const MOTIVO_BLOCK_LF = "').join('')}\n" +
    "                    </div>\n" +
    "                    ${(function() {\n" +
    "                        var _m = req.motivo || req.observacion || req.comentario || (req.payload && (req.payload.motivo || req.payload.observacion)) || '';\n" +
    "                        var _o = req.observacion_admin || req.nota_admin || (req.payload && req.payload.observacion_admin) || '';\n" +
    "                        if (!_m && !_o) return '';\n" +
    "                        var html = '<div style=\"margin-top:12px; padding:12px 14px; background:#f1f5f9; border-radius:10px; border-left:3px solid #cbd5e1; font-size:0.8rem;\">';\n" +
    "                        if (_m) html += '<div style=\"margin-bottom:' + (_o ? '8px' : '0') + '\"><span style=\"font-weight:800; color:#475569; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em;\">Motivo de la solicitud</span><div style=\"margin-top:3px; color:#0f172a; font-weight:600;\">' + _m + '</div></div>';\n" +
    "                        if (_o) html += '<div><span style=\"font-weight:800; color:#0ea5e9; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em;\">Observaci\u00f3n admin</span><div style=\"margin-top:3px; color:#334155;\">' + _o + '</div></div>';\n" +
    "                        html += '</div>';\n" +
    "                        return html;\n" +
    "                    }())}\n" +
    "                </div>\n" +
    "            `";

if (adminContent.includes(REQ_GRID_END)) {
    adminContent = adminContent.replace(REQ_GRID_END, MOTIVO_BLOCK_LF);
    console.log('[FIX 4] renderRequests motivo — OK');
    fixes++;
} else if (adminContent.includes(REQ_GRID_END_CRLF)) {
    adminContent = adminContent.replace(REQ_GRID_END_CRLF, MOTIVO_BLOCK_LF.replace(/\n/g, '\r\n'));
    console.log('[FIX 4] renderRequests motivo (CRLF) — OK');
    fixes++;
} else {
    // Look for the pattern in context
    const reqLines = adminContent.split('\n');
    for (let i = 2100; i < 2135 && i < reqLines.length; i++) {
        if (reqLines[i].includes('join') || reqLines[i].includes('</div>') || reqLines[i].includes('`')) {
            console.log(`  REQ L${i+1}: ${reqLines[i].substring(0, 80)}`);
        }
    }
    console.warn('[FIX 4] renderRequests close pattern not found');
}

// Save admin.js
fs.writeFileSync('admin.js', adminContent, 'utf8');
console.log('\n=== admin.js fixes:', fixes, '===');
console.log('File size:', fs.statSync('admin.js').size, 'bytes');

// ── solicitud.html — fix mojibake in comments ──────────────────
let solicitudContent = fs.readFileSync('solicitud.html', 'utf8');
let solFixes = 0;
const SOL_FIXES = [
    ['\u00c3\u00b3', '\u00f3'],  // Ã³ -> ó
    ['\u00c3\u00b1', '\u00f1'],  // Ã± -> ñ
    ['\u00c3\u00a1', '\u00e1'],  // Ã¡ -> á
    ['\u00c3\u00a9', '\u00e9'],  // Ã© -> é
    ['\u00c3\u00ba', '\u00fa'],  // Ãº -> ú
    ['\u00c3\u00ad', '\u00ed'],  // Ã­ -> í
    ['\u00c3\u0081', '\u00c1'],  // Ã -> Á
    ['\u00c3\u0093', '\u00d3'],  // Ã" -> Ó
    ['\u00c3\u009a', '\u00da'],  // Ãš -> Ú
];
SOL_FIXES.forEach(([from, to]) => {
    const count = (solicitudContent.split(from).length - 1);
    if (count > 0) {
        solicitudContent = solicitudContent.split(from).join(to);
        console.log('[SOL] Fixed', count, 'x:', from, '->', to);
        solFixes += count;
    }
});
fs.writeFileSync('solicitud.html', solicitudContent, 'utf8');
console.log('=== solicitud.html fixes:', solFixes, '===');
