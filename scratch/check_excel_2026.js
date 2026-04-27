const XLSX = require('../xlsx.full.min.js');
const fs = require('fs');

try {
    const buf = fs.readFileSync('V.9-Turnos.xlsx');
    const wb = XLSX.read(buf, {type:'buffer'});
    const sheet = wb.Sheets['Sercotel Guadiana'];
    const data = XLSX.utils.sheet_to_json(sheet, {header:1});
    console.log('--- Buscando Dani/Diana en Sercotel Guadiana (2026) ---');
    data.forEach((r, idx) => {
        const val = r[0];
        if (typeof val === 'number') {
            const ms = Math.round((val - 25569) * 86400 * 1000);
            const d = new Date(ms);
            if (d.getFullYear() === 2026) {
                const name = String(r[1] || '');
                if (name.includes('Dani') || name.includes('Diana')) {
                    console.log(`Fila ${idx} [${d.toISOString().split('T')[0]}]:`, r);
                }
            }
        }
    });
} catch (e) {
    console.error(e);
}
