const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 
    'apikey': key, 
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
};

async function insertRefuerzo() {
    // Delete the one I just inserted
    await fetch(`${url}/rest/v1/eventos_cuadrante?empleado_id=eq.Miriam&tipo=eq.REFUERZO`, {
        method: 'DELETE',
        headers: HEADERS
    });

    const toInsert = {
        tipo: 'REFUERZO',
        estado: 'activo',
        empleado_id: 'Miriam',
        hotel_origen: 'Cumbria Spa&Hotel',
        fecha_inicio: '2026-09-28',
        fecha_fin: '2026-10-04',
        observaciones: 'Forzado para visibilidad en admin',
        payload: { tipo_modulo: 'refuerzo' }
    };
    
    let res = await fetch(`${url}/rest/v1/eventos_cuadrante`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify([toInsert])
    });
    console.log("Status:", res.status, await res.text());
}

insertRefuerzo().catch(console.error);
