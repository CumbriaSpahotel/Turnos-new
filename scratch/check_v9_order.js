const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'v9_excel_order_map.json'), 'utf8'));

// Cumbria 27/04
const cumbria2704 = data.filter(x => x.hotel && x.hotel.includes('Cumbria') && x.week_start === '2026-04-27');
console.log('=== Cumbria V9 Excel Order 2026-04-27 ===');
cumbria2704.sort((a,b)=>(a.order||999)-(b.order||999));
cumbria2704.forEach(x => console.log(`  order=${x.order} | emp=${x.empleado_id}`));

// Also Cumbria all weeks
const cumbriaAll = data.filter(x => x.hotel && x.hotel.includes('Cumbria'));
const weeks = [...new Set(cumbriaAll.map(x=>x.week_start))].sort();
console.log('\nWeeks with Cumbria V9 data:', weeks.join(', '));

// Guadiana 27/04
const guadiana2704 = data.filter(x => x.hotel && x.hotel.includes('Guadiana') && x.week_start === '2026-04-27');
console.log('\n=== Sercotel Guadiana V9 Excel Order 2026-04-27 ===');
guadiana2704.sort((a,b)=>(a.order||999)-(b.order||999));
guadiana2704.forEach(x => console.log(`  order=${x.order} | emp=${x.empleado_id}`));
