const XLSX = require('xlsx');

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheet = workbook.Sheets['Cumbria Spa&Hotel'];

// No defval, so we can see the exact array
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

const excelCellDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        return value.toISOString().split('T')[0];
    }
    if (typeof value === 'number') {
        const ms = Math.round((value - 25569) * 86400 * 1000);
        return new Date(ms).toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
        const part = value.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
        const match = part.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
        if (match) return `20${match[3]}-${match[2]}-${match[1]}`;
    }
    return null;
};

const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

console.log("=== A) EXCEL LITERAL (FILA CRUDA) ===");
console.log("row_excel | empleado | lunes | martes | miércoles | jueves | viernes | sábado | domingo");

let week20Found = false;
let uniqueDates = new Set();

rows.forEach((row, idx) => {
    const dateStr = excelCellDate(row[0]);
    if (dateStr) uniqueDates.add(dateStr);
    
    if (dateStr === '2026-04-20') {
        week20Found = true;
        const emp = row[1];
        if (emp && emp !== 'Empleado') {
            // Log exactly what's in the array at each index
            console.log(`${idx} | ${emp} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} | ${row[6]} | ${row[7]} | ${row[8]}`);
        }
    }
});

console.log("\n=== B) DATASET QUE EL IMPORTADOR GENERARÍA ===");
console.log("empleado | fecha | dia_semana | turno_literal | turno_normalizado");

const diasSemana = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

rows.forEach((row, idx) => {
    const dateStr = excelCellDate(row[0]);
    if (dateStr === '2026-04-20') {
        const emp = row[1];
        if (emp && emp !== 'Empleado') {
            for (let i = 0; i < 7; i++) {
                const date = addDays(dateStr, i);
                const turnoRaw = String(row[i + 2] || '').trim();
                let turnoNorm = turnoRaw.charAt(0).toUpperCase();
                if (turnoNorm === '—') turnoNorm = '-';
                if (!['M', 'T', 'N', 'D', '-'].includes(turnoNorm)) turnoNorm = turnoRaw; // Fallback for debugging
                
                console.log(`${emp} | ${date} | ${diasSemana[i]} | ${turnoRaw} | ${turnoNorm}`);
            }
            console.log('---');
        }
    }
});

console.log("\nApril 2026 dates found:", Array.from(uniqueDates).filter(d => d.startsWith('2026-04')));

const targetDate = Array.from(uniqueDates).find(d => d.startsWith('2026-04-19') || d.startsWith('2026-04-20'));
console.log("Target Date for analysis:", targetDate);

rows.forEach((row, idx) => {
    const dateStr = excelCellDate(row[0]);
    if (dateStr === targetDate) {
        week20Found = true;
        const emp = row[1];
        if (emp && emp !== 'Empleado') {
            console.log(`${idx} | ${emp} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} | ${row[6]} | ${row[7]} | ${row[8]}`);
        }
    }
});


