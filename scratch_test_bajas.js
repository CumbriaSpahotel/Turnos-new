const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function checkBajas() {
    let res = await fetch(url + '/rest/v1/bajas_permisos?empleado_id=eq.Federico', { headers: HEADERS });
    console.log("Fede bajas:", await res.json());
}
checkBajas();
