const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function checkEventos() {
    let res = await fetch(url + '/rest/v1/eventos_cuadrante?empleado_id=eq.Federico', { headers: HEADERS });
    console.log("Fede eventos:", await res.json());
}
checkEventos();
