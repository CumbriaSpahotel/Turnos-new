const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };

async function insertRefuerzos() {
    // delete previous block event
    await fetch(`${url}/rest/v1/eventos_cuadrante?empleado_id=eq.Miriam&tipo=eq.REFUERZO`, { method: 'DELETE', headers: HEADERS });

    const shifts = ['M', 'N', 'N', 'D', 'D', 'T', 'T'];
    const dates = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    let toInsert = [];

    for (let i = 0; i < 7; i++) {
        toInsert.push({
            tipo: 'CAMBIO_TURNO',
            estado: 'activo',
            empleado_id: 'Miriam',
            hotel_origen: 'Cumbria Spa&Hotel',
            fecha_inicio: dates[i],
            fecha_fin: dates[i],
            turno_nuevo: shifts[i],
            observaciones: 'Falta Miriam',
            payload: { tipo_modulo: 'refuerzo', destino: shifts[i], refuerzo: true }
        });
    }

    let res = await fetch(`${url}/rest/v1/eventos_cuadrante`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(toInsert)
    });
    console.log("Status:", res.status, await res.text());
}

insertRefuerzos().catch(console.error);
