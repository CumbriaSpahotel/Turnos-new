const XLSX = require('xlsx');
const fs = require('fs');

async function auditExcel() {
    const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = 'Cumbria Spa&Hotel';
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    
    console.log("Fechas encontradas:");
    for (let i = 1; i < Math.min(20, data.length); i++) {
        console.log(`Fila ${i}: ${data[i][0]} -> Tipo: ${typeof data[i][0]}`);
    }
}
auditExcel();
