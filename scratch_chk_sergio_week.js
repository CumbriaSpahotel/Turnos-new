const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function chk() {
    let res = await fetch(`${url}/rest/v1/eventos_cuadrante?empleado_id=eq.Sergio&fecha_inicio=gte.2026-09-28&fecha_inicio=lte.2026-10-04`, { headers: HEADERS });
    console.log("Sergio this week:", await res.json());

    res = await fetch(`${url}/rest/v1/eventos_cuadrante?empleado_destino_id=eq.Sergio&fecha_inicio=gte.2026-09-28&fecha_inicio=lte.2026-10-04`, { headers: HEADERS });
    console.log("Sergio dest this week:", await res.json());
}
chk().catch(console.error);
