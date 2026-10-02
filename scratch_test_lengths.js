const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function checkTurnos() {
    let res = await fetch(`${url}/rest/v1/turnos?empleado_id=eq.Esther&fecha=gte.2026-09-28&fecha=lte.2026-10-04`, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
    console.log("Esther turnos:", (await res.json()).length);
}

checkTurnos().catch(console.error);
