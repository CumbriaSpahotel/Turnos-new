const fs = require('fs');
const path = require('path');
const {createClient} = require('../temp_node/node_modules/@supabase/supabase-js');

// Simulate what V139 will produce using the v9_excel_order_map.json
const v9Raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'v9_excel_order_map.json'), 'utf8'));
const normalizeV9Key = s => String(s || '').toLowerCase().trim();
const v9Index = {};
v9Raw.forEach(item => {
    const h = normalizeV9Key(item.hotel);
    const w = item.week_start;
    const e = normalizeV9Key(item.empleado_id);
    if (!v9Index[h]) v9Index[h] = {};
    if (!v9Index[h][w]) v9Index[h][w] = {};
    v9Index[h][w][e] = item;
});

function getV9Order(hotel, week, emp) {
    const h = normalizeV9Key(hotel);
    const e = normalizeV9Key(emp);
    const weekData = v9Index[h] && v9Index[h][week];
    if (!weekData) return null;
    const item = weekData[e];
    return item ? item.order : null;
}

const sb = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

// Get V138 Cumbria 27/04 snapshot
sb.from('publicaciones_cuadrante').select('snapshot_json').eq('version',138).eq('semana_inicio','2026-04-27').eq('hotel','Cumbria Spa&Hotel').single().then(({data, error}) => {
    if (error) { console.error(JSON.stringify(error)); process.exit(1); }
    const snap = typeof data.snapshot_json === 'string' ? JSON.parse(data.snapshot_json) : data.snapshot_json;
    const rows = JSON.parse(JSON.stringify(snap.rows || []));

    // Apply V139 puestoOrden using real v9 order
    const hotel = 'Cumbria Spa&Hotel';
    const week = '2026-04-27';

    rows.forEach((row, idx) => {
        const empName = row.nombre || row.empleado_id || '';
        const titularName = row.titularOriginalId || '';
        const rowType = row.rowType || 'operativo';

        if (rowType === 'ausencia_informativa') {
            const v9 = getV9Order(hotel, week, empName) || (500 + idx);
            row.puestoOrdenV139 = v9 + 1000;
        } else if (titularName && titularName !== empName) {
            // sustituto — hereda orden del titular
            const v9Titular = getV9Order(hotel, week, titularName);
            row.puestoOrdenV139 = v9Titular !== null ? v9Titular : (getV9Order(hotel, week, empName) || 500 + idx);
        } else {
            row.puestoOrdenV139 = getV9Order(hotel, week, empName) || (500 + idx);
        }
    });

    // Sort
    rows.sort((a, b) => {
        const absA = a.rowType === 'ausencia_informativa';
        const absB = b.rowType === 'ausencia_informativa';
        if (absA !== absB) return absA ? 1 : -1;
        return (a.puestoOrdenV139 || 9999) - (b.puestoOrdenV139 || 9999);
    });

    console.log('=== Cumbria V139 simulated order 2026-04-27 ===');
    rows.forEach((r, i) => {
        const sub = r.titularOriginalId && r.titularOriginalId !== r.nombre ? ` [sust->${r.titularOriginalId}]` : '';
        const abs = r.rowType === 'ausencia_informativa' ? ' [AUSENTE]' : '';
        console.log(`${i}: puestoOrden=${r.puestoOrdenV139} | ${r.nombre}${sub}${abs}`);
    });

    setTimeout(()=>process.exit(0), 300);
});
