const XLSX = require('../xlsx.full.min.js');
const fs = require('fs');

const FILE_PATH = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';

function inspect() {
    try {
        const buffer = fs.readFileSync(FILE_PATH);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        workbook.SheetNames.forEach(sheetName => {
            console.log(`\n--- SHEET: ${sheetName} ---`);
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            data.slice(0, 15).forEach((row, i) => {
                console.log(`Row ${i}:`, JSON.stringify(row).slice(0, 200));
            });
        });
    } catch (err) {
        console.error('Inspect failed:', err.message);
    }
}

inspect();
