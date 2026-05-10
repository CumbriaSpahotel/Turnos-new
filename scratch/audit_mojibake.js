const fs = require('fs');
const path = require('path');

const FILES = [
  'admin.js', 'admin.html', 'shift-resolver.js', 'supabase-dao.js',
  'index.html', 'bajas-module.js', 'vacaciones-module.js', 'sync-gaps.js',
  'cambios-module.js', 'turnos-rules.js', 'turnos-engine.js', 'excel-loader.js',
  'turnos-rules.js', 'sync-status.js'
];

// Patterns that indicate double-encoded UTF-8 (Latin-1 misread)
// Valid Spanish UTF-8 like "ñ", "ó", "á" should NOT match these patterns
const MOJIBAKE_RE = /Ã[ƒÂ‚±©³¡°¼¨½¬°°]|â€[™"œžŸ]|â€[^a-z]|Ã©|Ã±|ÃƒÂ|Â±|Â©|Â³|Â¡|Â°|\uFFFD/;

let total = 0;
FILES.forEach(f => {
  if (!fs.existsSync(f)) return;
  const raw = fs.readFileSync(f, 'utf8');
  const lines = raw.split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (MOJIBAKE_RE.test(line)) {
      hits.push({ line: i + 1, text: line.substring(0, 150).trim() });
    }
  });
  if (hits.length) {
    console.log(`\n=== ${f} (${hits.length} lines) ===`);
    hits.slice(0, 20).forEach(h => console.log(`  L${h.line}: ${h.text}`));
    if (hits.length > 20) console.log(`  ... and ${hits.length - 20} more`);
    total += hits.length;
  }
});
console.log(`\nTOTAL MOJIBAKE LINES: ${total}`);
