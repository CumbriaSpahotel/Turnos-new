const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function getCount(table, params) {
    const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
        method: 'HEAD',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Prefer': 'count=exact' }
    });
    return res.headers.get('content-range');
}

async function main() {
    const dG = await getCount('turnos', 'hotel_id=eq.Sercotel Guadiana&empleado_id=eq.Diana&fecha=gte.2026-10-12');
    console.log('Diana Guadiana count range:', dG);
    const cC = await getCount('turnos', 'hotel_id=eq.Cumbria Spa%26Hotel&empleado_id=eq.Cristina&fecha=gte.2026-10-12');
    console.log('Cristina Cumbria count range:', cC);
}

main().catch(console.error);
