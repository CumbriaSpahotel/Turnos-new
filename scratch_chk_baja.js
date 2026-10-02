const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function chk() {
    let res = await fetch(`${url}/rest/v1/eventos_cuadrante?empleado_id=eq.Sergio&tipo=eq.BAJA`, { headers: HEADERS });
    console.log("Sergio BAJA:", await res.json());

    res = await fetch(`${url}/rest/v1/eventos_cuadrante?empleado_id=eq.Sergio%20Sánchez&tipo=eq.BAJA`, { headers: HEADERS });
    console.log("S. Sánchez BAJA:", await res.json());
}
chk().catch(console.error);
