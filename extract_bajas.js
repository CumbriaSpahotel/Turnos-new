const XLSX = require('./temp_node/node_modules/xlsx');
const fs = require('fs');

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\Plantilla Cuadrante con Sustituciones v.6.0.xlsx';
const workbook = XLSX.readFile(filePath);

const sheetName = 'Bajas y Permisos';
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

const results = data.map(row => {
    let dateStr = '';
    if (row.Fecha) {
        // Excel dates start from 1899-12-30
        const date = new Date((row.Fecha - 25569) * 86400 * 1000);
        dateStr = date.toISOString().split('T')[0];
    }
    
    // Normalizar tipo
    let tipoFinal = 'NORMAL';
    const rawTipo = String(row.TipoAusencia || '').toLowerCase();
    if (rawTipo.includes('baja')) tipoFinal = 'BAJA 🏥';
    else if (rawTipo.includes('perm')) tipoFinal = 'PERM 🗓️';

    return {
        hotel_id: row.Hotel || '',
        fecha: dateStr,
        empleado_id: row.Empleado || '',
        sustituto: row.Sustituto || '',
        turno: row.TurnoOriginal || (tipoFinal.startsWith('BAJA') ? 'B' : 'P'),
        tipo: tipoFinal
    };
}).filter(r => r.fecha && r.empleado_id);

fs.writeFileSync('bajas_final.json', JSON.stringify(results, null, 2), 'utf8');
console.log(`Successfully extracted ${results.length} records from Bajas y Permisos.`);
