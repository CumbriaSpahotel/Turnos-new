const XLSX = require('xlsx');

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheet = workbook.Sheets['Cumbria Spa&Hotel'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

const excelCellDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        // Fix for time zone shifts: if it's near midnight, it might be shifted
        // But let's just see what it gives us first
        return value.toISOString().split('T')[0];
    }
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

const targetAnchor = '2026-04-19'; // What xlsx gives us for "20-abr.-26"

console.log("=== 1. EXCEL LITERAL (FILA 336 - Cristina) ===");
const cristinaRow = rows[336];
console.log(`Fila: ${336} | Emp: ${cristinaRow[1]} | L:${cristinaRow[2]} | M:${cristinaRow[3]} | X:${cristinaRow[4]} | J:${cristinaRow[5]} | V:${cristinaRow[6]} | S:${cristinaRow[7]} | D:${cristinaRow[8]}`);

console.log("\n=== 2. DATASET GENERADO ANTES (ERRÓNEO) ===");
// Using currentWeek = 2026-04-19 directly
for (let i = 0; i < 7; i++) {
    const date = addDays(targetAnchor, i);
    const turnoRaw = cristinaRow[i + 2];
    console.log(`${cristinaRow[1]} | ${date} | ${turnoRaw}`);
}

console.log("\n=== 3. DATASET GENERADO DESPUÉS (CORREGIDO) ===");
// Correction: If it's Sunday, we want Lunes to be targetAnchor + 1
let weekStart = targetAnchor;
const d = new Date(targetAnchor);
if (d.getUTCDay() === 0) { // Sunday
    d.setUTCDate(d.getUTCDate() + 1);
    weekStart = d.toISOString().split('T')[0];
}
console.log("Corrected Week Start (Monday):", weekStart);

for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const turnoRaw = cristinaRow[i + 2];
    console.log(`${cristinaRow[1]} | ${date} | ${turnoRaw}`);
}
