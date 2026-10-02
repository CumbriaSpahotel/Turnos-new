const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function checkTurnos() {
    let res = await fetch(url + '/rest/v1/turnos?turno=eq.X&limit=2', { headers: HEADERS });
    console.log("X in turnos:", await res.json());

    res = await fetch(url + '/rest/v1/turnos?turno=eq.B&limit=2', { headers: HEADERS });
    console.log("B in turnos:", await res.json());

    // let's fetch fede's shifts for this period to see what it has currently
    res = await fetch(url + '/rest/v1/turnos?empleado_id=eq.Federico&fecha=gte.2026-09-28&fecha=lte.2026-10-04', { headers: HEADERS });
    console.log("Fede currently:", await res.json());
}
checkTurnos();
