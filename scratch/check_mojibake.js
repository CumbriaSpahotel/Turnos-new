const fs = require('fs');
const c = fs.readFileSync('admin.js', 'utf8');
const checks = ['MaÃ±ana', 'Ã³', 'Ã©', 'Ã­', 'Ã¡', 'Ãº', 'Ã±'];
let found = 0;
checks.forEach(m => {
    const n = c.split(m).length - 1;
    if (n > 0) { console.log('REMAINING:', n, 'x', m); found += n; }
});
// Also check fmtDateLegacy return value
const line20 = c.split('\n')[19];
console.log('fmtDateLegacy empty return:', line20.trim());
console.log('Total remaining mojibake:', found);
