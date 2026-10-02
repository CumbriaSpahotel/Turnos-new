const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function chk() {
    let res = await fetch(`${url}/rest/v1/eventos_cuadrante?tipo=eq.BAJA&estado=eq.activo`, { headers: HEADERS });
    let data = await res.json();
    console.log(data.filter(e => e.empleado_id.includes('Sergio')));
}
chk().catch(console.error);
