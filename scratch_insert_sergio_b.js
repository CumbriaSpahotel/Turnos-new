const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };

async function insertSergioBajaTurnos() {
    let toInsert = [];
    const dates = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    
    for (let i = 0; i < 7; i++) {
        toInsert.push({
            hotel_id: 'Cumbria Spa&Hotel',
            empleado_id: 'Sergio',
            fecha: dates[i],
            turno: 'b',
            tipo: 'NORMAL',
            updated_by: 'SCRIPT_MANUAL'
        });
    }

    let res = await fetch(`${url}/rest/v1/turnos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(toInsert)
    });
    console.log("Status:", res.status);
    if (!res.ok) console.log(await res.text());
}

insertSergioBajaTurnos().catch(console.error);
