const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 
    'apikey': key, 
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
};

async function checkMiriam() {
    let res = await fetch(`${url}/rest/v1/turnos?empleado_id=eq.Miriam&fecha=gte.2026-09-28&fecha=lte.2026-10-04`, { headers: HEADERS });
    let data = await res.json();
    console.log("Miriam shifts:", data);
}

checkMiriam().catch(console.error);
