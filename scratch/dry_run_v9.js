const XLSX = require('../xlsx.full.min.js');
const fs = require('fs');

const FILE_PATH = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
const PERMITTED_CODES = ['M', 'T', 'N', 'D', '-'];

const TURN_MAP = {
    'MAÑANA': 'M', 'M': 'M',
    'TARDE': 'T', 'T': 'T',
    'NOCHE': 'N', 'N': 'N',
    'DESCANSO': 'D', 'D': 'D',
    'PENDIENTE': '-', '-': '-', '—': '-', '': '-'
};

function dryRun() {
    try {
        const buffer = fs.readFileSync(FILE_PATH);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        const summary = {
            sheets: workbook.SheetNames,
            totalRecords: 0,
            dateRange: { min: null, max: null },
            hoteles: new Set(),
            empleados: new Set(),
            rawCodes: {},
            normalizedCodes: {},
            invalidCodes: {},
            duplicates: 0,
            validRecords: 0,
            sheetDetails: {}
        };

        const uniqueKeys = new Set();

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            summary.hoteles.add(sheetName);
            summary.sheetDetails[sheetName] = { rows: 0, records: 0 };

            data.forEach((row, rowIndex) => {
                if (rowIndex === 0) return; // Header
                if (!row[0] || !row[1]) return; // Empty or invalid row

                const weekStartVal = row[0];
                const empName = String(row[1]).trim();
                
                if (isNaN(weekStartVal) && typeof weekStartVal !== 'number') return;

                let weekStartDate;
                if (typeof weekStartVal === 'number') {
                    weekStartDate = new Date(Math.round((weekStartVal - 25569) * 86400 * 1000));
                } else {
                    weekStartDate = new Date(weekStartVal);
                }

                if (isNaN(weekStartDate.getTime())) return;

                summary.empleados.add(empName);
                summary.sheetDetails[sheetName].rows++;

                // Iterar sobre los 7 días de la semana (Lunes a Domingo)
                for (let i = 0; i < 7; i++) {
                    const currentDate = new Date(weekStartDate);
                    currentDate.setDate(weekStartDate.getDate() + i);
                    const dateStr = currentDate.toISOString().split('T')[0];

                    if (!summary.dateRange.min || dateStr < summary.dateRange.min) summary.dateRange.min = dateStr;
                    if (!summary.dateRange.max || dateStr > summary.dateRange.max) summary.dateRange.max = dateStr;

                    const rawVal = String(row[i + 2] || '').trim();
                    const normVal = TURN_MAP[rawVal.toUpperCase()] || rawVal.toUpperCase();
                    
                    summary.rawCodes[rawVal.toUpperCase()] = (summary.rawCodes[rawVal.toUpperCase()] || 0) + 1;
                    summary.normalizedCodes[normVal] = (summary.normalizedCodes[normVal] || 0) + 1;

                    if (!PERMITTED_CODES.includes(normVal)) {
                        summary.invalidCodes[rawVal.toUpperCase()] = (summary.invalidCodes[rawVal.toUpperCase()] || 0) + 1;
                    } else {
                        summary.validRecords++;
                    }

                    const key = `${sheetName}|${empName}|${dateStr}`;
                    if (uniqueKeys.has(key)) {
                        summary.duplicates++;
                    } else {
                        uniqueKeys.add(key);
                        summary.totalRecords++;
                        summary.sheetDetails[sheetName].records++;
                    }
                }
            });
        });

        console.log('--- DRY RUN SUMMARY ---');
        console.log('Sheets:', summary.sheets.join(', '));
        console.log('Date Range:', summary.dateRange.min, 'to', summary.dateRange.max);
        console.log('Unique Employees:', summary.empleados.size);
        console.log('Total Records to Upsert:', summary.totalRecords);
        console.log('Duplicates detected in Excel (same hotel/emp/date):', summary.duplicates);
        
        console.log('\n--- BY SHEET ---');
        Object.entries(summary.sheetDetails).forEach(([name, d]) => {
            console.log(`${name}: ${d.rows} employee-weeks, ${d.records} day-records`);
        });

        console.log('\n--- CODES DISTRIBUTION (NORMALIZED) ---');
        Object.entries(summary.normalizedCodes).sort((a,b) => b[1] - a[1]).forEach(([code, count]) => {
            console.log(`${code || '(vacio)'}: ${count}`);
        });
        
        if (Object.keys(summary.invalidCodes).length > 0) {
            console.log('\n--- NON-PERMITTED CODES DETECTED (WILL BE REJECTED OR REPORTED) ---');
            Object.entries(summary.invalidCodes).forEach(([code, count]) => {
                console.log(`${code}: ${count}`);
            });
        } else {
            console.log('\nNo non-permitted codes detected.');
        }

    } catch (err) {
        console.error('Dry run failed:', err.message);
        console.error(err);
    }
}

dryRun();
