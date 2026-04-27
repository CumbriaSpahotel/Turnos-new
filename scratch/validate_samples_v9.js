const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
const workbook = XLSX.readFile(filePath, { cellDates: true });

const excelCellDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'number') {
        const ms = Math.round((value - 25569) * 86400 * 1000);
        return new Date(ms).toISOString().split('T')[0];
    }
    return null;
};

const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

const samples = [
    { hotel: 'Cumbria Spa&Hotel', pattern: '2026-04-20' },
    { hotel: 'Cumbria Spa&Hotel', pattern: '2026-04-27' },
    { hotel: 'Sercotel Guadiana', pattern: '2026-04-20' },
    { hotel: 'Cumbria Spa&Hotel', pattern: '2025-01' },
    { hotel: 'Cumbria Spa&Hotel', pattern: '2026-12' },
    { hotel: 'Cumbria Spa&Hotel', pattern: '2030' },
    { hotel: 'Cumbria Spa&Hotel', pattern: '2036' }
];

function validate(hotel, pattern) {
    console.log(`\n>>> VALIDANDO: ${hotel} | Patrón: ${pattern}`);
    const sheet = workbook.Sheets[hotel];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    
    let currentWeek = null;
    let found = false;
    rows.forEach((row, idx) => {
        const rawDate = excelCellDate(row[0]);
        if (rawDate) {
            const d = new Date(rawDate);
            if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
            currentWeek = d.toISOString().split('T')[0];
        }

        if (currentWeek && currentWeek.includes(pattern) && !found) {
            found = true;
            console.log(`Week Start: ${currentWeek} (Row ${idx})`);
            const emp = row[1];
            if (emp && emp !== 'Empleado') {
                console.log(`Excel Literal: ${emp} | L:${row[2]} M:${row[3]} X:${row[4]} J:${row[5]} V:${row[6]} S:${row[7]} D:${row[8]}`);
                console.log("Dataset generado:");
                for (let i = 0; i < 7; i++) {
                    const date = addDays(currentWeek, i);
                    console.log(`  ${date} -> ${row[i + 2]}`);
                }
            }
        }
    });
}

samples.forEach(s => validate(s.hotel, s.pattern));
