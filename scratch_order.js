const fs = require('fs');
const map = JSON.parse(fs.readFileSync('data/v9_excel_order_map.json', 'utf8'));

const entries = map.filter(m => m.week_start === '2026-10-12');
console.log('Entries for 2026-10-12:', JSON.stringify(entries, null, 2));
