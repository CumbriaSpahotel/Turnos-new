const XLSX = require('../xlsx.full.min.js');
const fs = require('fs');

const FILE_PATH = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';

function debugExcel() {
    try {
        const buffer = fs.readFileSync(FILE_PATH);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            console.log(`\n--- Searching in ${sheetName} ---`);
            data.forEach((row, rowIndex) => {
                const empName = String(row[1] || '').trim();
                const weekStartVal = row[0];

                if (empName.includes('Valentín') || empName.includes('Miriam')) {
                    let weekStartDate;
                    if (typeof weekStartVal === 'number') {
                        weekStartDate = new Date(Math.round((weekStartVal - 25569) * 86400 * 1000));
                        const dateStr = weekStartDate.toISOString().split('T')[0];
                        
                        if (dateStr === '2026-04-06' || dateStr === '2026-04-13') {
                            console.log(`Row ${rowIndex}:`, JSON.stringify(row));
                        }
                    }
                }
            });
        });
    } catch (err) {
        console.error('Debug failed:', err.message);
    }
}

debugExcel();
