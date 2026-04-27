const XLSX = require('../xlsx.full.min.js');
const fs = require('fs');

try {
    const buf = fs.readFileSync('V.9-Turnos.xlsx');
    const wb = XLSX.read(buf, {type:'buffer'});
    const sheet = wb.Sheets['Sercotel Guadiana'];
    const data = XLSX.utils.sheet_to_json(sheet, {header:1});
    console.log('--- Buscando años en Sercotel Guadiana ---');
    const years = new Set();
    data.forEach((r, idx) => {
        const val = r[0];
        if (typeof val === 'number') {
            const ms = Math.round((val - 25569) * 86400 * 1000);
            const d = new Date(ms);
            years.add(d.getFullYear());
        }
    });
    console.log('Años encontrados:', Array.from(years).sort());
} catch (e) {
    console.error(e);
}
