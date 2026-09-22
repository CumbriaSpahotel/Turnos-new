const fs = require("fs");
const cfg = fs.readFileSync("supabase-config.js", "utf8");
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function query(table, params = "") {
    const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    return res.json();
}

async function main() {
    const events = await query("eventos_cuadrante", "select=*&fecha_inicio=gte.2026-10-01&fecha_inicio=lte.2026-10-31&order=fecha_inicio.asc");
    console.log("October 2026 events in eventos_cuadrante:", events.length);
    events.forEach(e => console.log(`${e.fecha_inicio} | ${e.tipo} | ${e.estado} | ${e.hotel_origen} | emp: ${e.empleado_id} -> dest: ${e.empleado_destino_id} | ${e.observaciones || ''}`));
}

main().catch(console.error);
