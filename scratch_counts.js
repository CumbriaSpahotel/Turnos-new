const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function query(table, params = '') {
    const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    return res.json();
}

async function main() {
    const dianaG = await query('turnos', 'select=id,fecha,turno&hotel_id=eq.Sercotel Guadiana&empleado_id=eq.Diana&fecha=gte.2026-10-12&order=fecha.asc');
    console.log(`Diana in Guadiana >= 2026-10-12 count: ${dianaG.length}. First: ${dianaG[0]?.fecha}, Last: ${dianaG[dianaG.length - 1]?.fecha}`);

    const crisC = await query('turnos', 'select=id,fecha,turno&hotel_id=eq.Cumbria Spa%26Hotel&empleado_id=eq.Cristina&fecha=gte.2026-10-12&order=fecha.asc');
    console.log(`Cristina in Cumbria >= 2026-10-12 count: ${crisC.length}. First: ${crisC[0]?.fecha}, Last: ${crisC[crisC.length - 1]?.fecha}`);

    // Also check if Diana has any turnos in Cumbria >= 2026-10-12
    const dianaC = await query('turnos', 'select=id&hotel_id=eq.Cumbria Spa%26Hotel&empleado_id=eq.Diana&fecha=gte.2026-10-12');
    console.log('Diana in Cumbria count:', dianaC.length);

    // Also check if Cristina has any turnos in Guadiana >= 2026-10-12
    const crisG = await query('turnos', 'select=id&hotel_id=eq.Sercotel Guadiana&empleado_id=eq.Cristina&fecha=gte.2026-10-12');
    console.log('Cristina in Guadiana count:', crisG.length);
}

main().catch(console.error);
