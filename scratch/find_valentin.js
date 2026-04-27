const XLSX = require('./xlsx.full.min.js');
const fs = require('fs');
const buffer = fs.readFileSync('V.9-Turnos.xlsx');
const workbook = XLSX.read(buffer, { type: 'buffer' });
const sheet = workbook.Sheets['Cumbria Spa&Hotel'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
data.forEach((row, i) => {
    if (String(row[1] || '').includes('Valentín') && row[0] === 46118) {
        console.log(`Row ${i}:`, JSON.stringify(row));
    }
});
