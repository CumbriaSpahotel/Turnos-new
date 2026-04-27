const XLSX = require('../xlsx.full.min.js');
const fs = require('fs');

try {
    const buf = fs.readFileSync('V.9-Turnos.xlsx');
    const wb = XLSX.read(buf, {type:'buffer'});
    const sheet = wb.Sheets['Sercotel Guadiana'];
    const data = XLSX.utils.sheet_to_json(sheet, {header:1});
    console.log('--- Buscando Dani/Diana en Sercotel Guadiana ---');
    data.forEach((r, idx) => {
        const name = String(r[1] || '');
        if (name.includes('Dani') || name.includes('Diana')) {
            console.log(`Fila ${idx}:`, r);
        }
    });
} catch (e) {
    console.error(e);
}
