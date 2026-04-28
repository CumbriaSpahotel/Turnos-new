/**
 * PREPARACIÓN PUBLICACIÓN MASIVA 2026 — TurnosWeb
 * Este script extrae la estructura completa de orden del Excel V.9 para todo el año 2026.
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = path.join(__dirname, '..', 'Plantilla Cuadrante con Sustituciones v.9.0.xlsx');

function toIso(v) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (typeof v === 'number') {
        const d = new Date(Math.round((v - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    if (typeof v === 'string') {
        const match = v.match(/(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
    }
    return null;
}

function crawlExcelStructure() {
    console.log('--- Iniciando rastreo de estructura Excel 2026 ---');
    const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
    const hotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    const structure = {};

    hotels.forEach(hotel => {
        const sheet = wb.Sheets[hotel];
        if (!sheet) return;
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
        structure[hotel] = {};

        matrix.forEach((row, idx) => {
            // Buscamos la fecha en col 0 o col 1 (varía según si es el inicio del bloque)
            const d0 = toIso(row[0]);
            const d1 = toIso(row[1]);
            const date = d1 || d0;
            
            if (!date || !date.startsWith('2026')) return;

            const name = String(row[2] || row[1] || '').trim();
            // Si col1 es la fecha, el nombre suele estar en col2. Si col0 es la fecha, nombre en col1.
            // Ajustamos según lo observado en los rastreos previos:
            let finalName = '';
            if (d1) finalName = String(row[2] || '').trim(); // Formato: [num, date, name]
            else if (d0) finalName = String(row[1] || '').trim(); // Formato: [date, name]

            if (!finalName || finalName === 'Semana' || finalName === 'Empleado') return;

            if (!structure[hotel][date]) structure[hotel][date] = [];
            structure[hotel][date].push(finalName);
        });
        
        const weekCount = Object.keys(structure[hotel]).length;
        console.log(`  Hotel [${hotel}]: ${weekCount} semanas encontradas.`);
    });

    return structure;
}

try {
    const structure = crawlExcelStructure();
    fs.writeFileSync(path.join(__dirname, 'excel_structure_2026.json'), JSON.stringify(structure, null, 2));
    console.log('\n✅ Estructura 2026 guardada en excel_structure_2026.json');
} catch (err) {
    console.error('❌ Error al rastrear Excel:', err.message);
}
