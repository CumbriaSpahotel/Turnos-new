const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 
    'apikey': key, 
    'Authorization': `Bearer ${key}`
};

async function checkTurnos() {
    let res = await fetch(`${url}/rest/v1/turnos?empleado_id=eq.EMP-0011&fecha=gte.2026-09-28&fecha=lte.2026-10-04`, { headers: HEADERS });
    console.log("Esther (EMP-0011) turnos:", await res.json());

    res = await fetch(`${url}/rest/v1/turnos?empleado_id=eq.Esther&fecha=gte.2026-09-28&fecha=lte.2026-10-04`, { headers: HEADERS });
    console.log("Esther (Esther) turnos:", await res.json());
}

checkTurnos().catch(console.error);
