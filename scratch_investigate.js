const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function query(table, params = '') {
    const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    return res.json();
}

async function main() {
    const evts1 = await query('eventos_cuadrante', 'select=*&fecha_fin=gte.2026-10-12&empleado_id=in.(Diana,Cristina)&order=fecha_inicio.asc');
    const evts2 = await query('eventos_cuadrante', 'select=*&fecha_fin=gte.2026-10-12&empleado_destino_id=in.(Diana,Cristina)&order=fecha_inicio.asc');
    const map = new Map();
    [...evts1, ...evts2].forEach(e => map.set(e.id, e));
    const all = Array.from(map.values()).sort((a,b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
    console.log(`Found ${all.length} events involving Diana or Cristina >= 2026-10-12:`);
    all.forEach(e => {
        console.log(`[${e.id}] tipo:${e.tipo} estado:${e.estado} fecha:${e.fecha_inicio}..${e.fecha_fin} de:${e.empleado_id} a:${e.empleado_destino_id} orig:${e.turno_original} nuevo:${e.turno_nuevo} obs:${e.observaciones}`);
    });
}

main().catch(console.error);
