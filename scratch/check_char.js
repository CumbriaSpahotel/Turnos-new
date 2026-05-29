const fs = require('fs');

// We want to check what character code is used in c.code !== '—' in admin.js
const adminJs = fs.readFileSync('admin.js', 'utf8');
const match = adminJs.match(/c\.code\s*&&\s*c\.code\s*!==\s*['"`]([^'"`]+)['"`]/);
if (match) {
  const char = match[1];
  console.log("admin.js duplicate check character:", char, "code:", char.charCodeAt(0).toString(16));
} else {
  console.log("Could not find match in admin.js");
}

// Let's also check turnos-rules.js or index.html to see what characters they write
const rulesJs = fs.readFileSync('turnos-rules.js', 'utf8');
const matchRules = rulesJs.match(/return\s*['"`]([^'"`]+)['"`];\s*\}/); // fallback
console.log("Rules emdash matches:");
const matches = rulesJs.match(/['"`][—–-]['"`]/g);
if (matches) {
  matches.forEach(m => {
    console.log("Match:", m, "char code:", m.charCodeAt(1).toString(16));
  });
}
