// Update v9_excel_order_map.json and v9_excel_order_map.js
// Replace Diana→Cristina in Guadiana, Cristina→vacante-cumbria-2 in Cumbria for weeks >= 2026-10-12

const fs = require('fs');

const JSON_PATH = 'data/v9_excel_order_map.json';
const JS_PATH = 'data/v9_excel_order_map.js';
const EFFECTIVE_DATE = '2026-10-12';

console.log('Loading order map...');
const raw = fs.readFileSync(JSON_PATH, 'utf8');
const map = JSON.parse(raw);

console.log(`Total entries: ${map.length}`);

let updatedDiana = 0;
let updatedCristina = 0;

for (const entry of map) {
    if (entry.week_start < EFFECTIVE_DATE) continue; // skip historical
    
    if (entry.hotel === 'Sercotel Guadiana' && entry.empleado_id === 'Diana') {
        entry.empleado_id = 'Cristina';
        entry.empleado_nombre = 'Cristina';
        updatedDiana++;
    } else if (entry.hotel === 'Cumbria Spa&Hotel' && entry.empleado_id === 'Cristina') {
        entry.empleado_id = 'vacante-cumbria-2';
        entry.empleado_nombre = 'SIN NOMBRE';
        entry.display_name = 'SIN NOMBRE';
        updatedCristina++;
    }
}

console.log(`Updated Diana→Cristina (Guadiana): ${updatedDiana}`);
console.log(`Updated Cristina→vacante-cumbria-2 (Cumbria): ${updatedCristina}`);

// Verify first modified week
const oct12 = map.filter(e => e.week_start === '2026-10-12');
console.log('\nOrder map entries for 2026-10-12:');
oct12.forEach(e => console.log(`  ${e.hotel}: [${e.order}] ${e.empleado_id} (${e.empleado_nombre})`));

// Last week before effective date
const oct05 = map.filter(e => e.week_start === '2026-10-05');
console.log('\nOrder map entries for 2026-10-05 (must be UNCHANGED):');
oct05.forEach(e => console.log(`  ${e.hotel}: [${e.order}] ${e.empleado_id} (${e.empleado_nombre})`));

// Write JSON
console.log('\nWriting v9_excel_order_map.json...');
fs.writeFileSync(JSON_PATH, JSON.stringify(map, null, 2), 'utf8');

// Write JS (with BOM and window._v9_excel_order_data variable)
console.log('Writing v9_excel_order_map.js...');
const jsContent = '\uFEFF// v9_excel_order_map.js - Auto-generado. Traslado Cristina→Guadiana / Diana→Apoyo efectivo 2026-10-12\n' +
    'window._v9_excel_order_data = ' + JSON.stringify(map) + ';\n';
fs.writeFileSync(JS_PATH, jsContent, 'utf8');

console.log('✅ Order maps updated');
