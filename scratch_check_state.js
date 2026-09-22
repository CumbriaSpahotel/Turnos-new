// Check what's causing the conflict in Cristina Guadiana
const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const BASE_HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function main() {
    // Check Cristina in Guadiana (might exist now from before the delete!)
    const crisG = await (await fetch(url+'/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Cristina&fecha=gte.2026-10-12&limit=5&order=fecha.asc', {headers:BASE_HEADERS})).json();
    console.log('Cristina in Guadiana >=2026-10-12 sample:', crisG.slice(0,3));

    const dianaG = await (await fetch(url+'/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Diana&fecha=gte.2026-10-12&limit=5', {headers:BASE_HEADERS})).json();
    console.log('Diana in Guadiana >=2026-10-12 sample:', dianaG.slice(0,3));

    // Check Cristina in Cumbria (was it already deleted?)
    const crisC = await (await fetch(url+'/rest/v1/turnos?hotel_id=eq.Cumbria%20Spa%26Hotel&empleado_id=eq.Cristina&fecha=gte.2026-10-12&limit=3', {headers:BASE_HEADERS})).json();
    console.log('Cristina in Cumbria >=2026-10-12 sample:', crisC.slice(0,3));

    const vacC = await (await fetch(url+'/rest/v1/turnos?hotel_id=eq.Cumbria%20Spa%26Hotel&empleado_id=eq.vacante-cumbria-2&fecha=gte.2026-10-12&limit=3', {headers:BASE_HEADERS})).json();
    console.log('vacante-cumbria-2 in Cumbria >=2026-10-12 sample:', vacC.slice(0,3));

    // Does Cristina have EXISTING turnos in Guadiana from OTHER sources (before the delete)?
    const allCrisG = await (await fetch(url+'/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Cristina&order=fecha.asc&limit=5', {headers:BASE_HEADERS})).json();
    console.log('All Cristina Guadiana (all dates) sample:', allCrisG.slice(0,5));
}
main().catch(console.error);
