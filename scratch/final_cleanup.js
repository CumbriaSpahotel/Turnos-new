const fs = require('fs');
const jsPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

// Fix the (Natalia -> Natalio) line if it's still broken
js = js.replace(/\n \(Natalia -> Natalio\) ---\r?\n/g, '\n// --- FIX DATA (Natalia -> Natalio) ---\n');
js = js.replace(/[^/]\s+\(Natalia -> Natalio\) ---\r?\n/g, '\n// --- FIX DATA (Natalia -> Natalio) ---\n');

fs.writeFileSync(jsPath, js);
console.log("admin.js final cleanup done.");
