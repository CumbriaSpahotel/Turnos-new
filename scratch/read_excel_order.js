/**
 * Lee el orden real del Excel V.9 para cada semana de mayo 2026 — Cumbria Spa&Hotel
 * Columna 0 = fecha, Columna 1 = nombre, Columnas 2-8 = turnos Lun-Dom
 */
const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname,'..','Plantilla Cuadrante con Sustituciones v.9.0.xlsx'),{cellDates:true});
const sheet = wb.Sheets['Cumbria Spa&Hotel'];
const matrix = XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});

const WEEKS = ['2026-05-04','2026-05-11','2026-05-18','2026-05-25'];

function toIso(v) {
    if(!v) return null;
    if(v instanceof Date) return v.toISOString().split('T')[0];
    if(typeof v === 'number') {
        // Excel serial date
        const d = new Date(Math.round((v - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    if(typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
    return null;
}

const weekMap = {};
WEEKS.forEach(w => weekMap[w] = []);

matrix.forEach((row, rowIdx) => {
    const ds = toIso(row[0]);
    if(!ds || !weekMap[ds]) return;
    const nombre = String(row[1] || '').trim();
    if(!nombre) return;
    const turnos = [row[2],row[3],row[4],row[5],row[6],row[7],row[8]].map(v => String(v||'').trim());
    weekMap[ds].push({ rowIdx, puestoOrden: weekMap[ds].length + 1, nombre, turnos });
});

WEEKS.forEach(w => {
    console.log('\n=== Semana', w, '===');
    weekMap[w].forEach(r => {
        console.log(`  PO=${r.puestoOrden} rowIdx=${r.rowIdx} nombre="${r.nombre}" turnos=[${r.turnos.join(',')}]`);
    });
});
