const XLSX = require('./temp_node/node_modules/xlsx');
const fs = require('fs');

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\Plantilla Cuadrante con Sustituciones v.6.0.xlsx';
const workbook = XLSX.readFile(filePath);

const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('vac') || s.toLowerCase().includes('ausencia'));
if (sheetName) {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    
    const results = data.map(row => {
        let dateStr = '';
        if (row.Fecha) {
            // Excel dates start from 1899-12-30
            const date = new Date((row.Fecha - 25569) * 86400 * 1000);
            dateStr = date.toISOString().split('T')[0];
        }
        return {
            hotel_id: row.Hotel || '',
            fecha: dateStr,
            empleado_id: row.Empleado || '',
            sustituto: row.Sustituto || '',
            tipo: 'VAC'
        };
    }).filter(r => r.fecha && r.empleado_id);

    fs.writeFileSync('vacs_final.json', JSON.stringify(results, null, 2), 'utf8');
    console.log(`Successfully extracted ${results.length} vacation records to vacs_final.json`);
} else {
    console.log('No vacation sheet found');
}
