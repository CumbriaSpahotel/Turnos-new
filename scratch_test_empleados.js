const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function getEmpleados() {
    const res = await fetch(url + '/rest/v1/empleados?select=id,nombre', { headers: HEADERS });
    const data = await res.json();
    console.log(data);
}
getEmpleados();
