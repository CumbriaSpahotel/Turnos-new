const XLSX = require('xlsx');

function formatDate(dateObj) {
    if (!dateObj) return null;
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function auditExcel() {
    const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = 'Cumbria Spa&Hotel';
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    
    const weeksToCheck = ['2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20'];
    
    console.log("=== 1. TABLA LITERAL DEL EXCEL ===");
    data.slice(1).forEach((row, i) => {
        let d = null;
        if (row[0] instanceof Date) {
            d = formatDate(row[0]);
        } else if (typeof row[0] === 'string') {
            d = row[0].split('T')[0];
        }
        
        if (weeksToCheck.includes(d)) {
            console.log(`${d} | Emp: "${row[1]}" | L:${row[2]} M:${row[3]} X:${row[4]} J:${row[5]} V:${row[6]} S:${row[7]} D:${row[8]}`);
        }
    });
}
auditExcel();
