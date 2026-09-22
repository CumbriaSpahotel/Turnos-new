// Diagnose: unique constraint - detect what's conflicting on turnos
const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const BASE_HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };

async function main() {
    // The unique constraint is "uniq_turno_emp_fecha" - likely on (empleado_id, fecha)
    // But Cristina in Guadiana shows 0 rows. So the conflict must come from Cristina in Cumbria dates collision
    // When we try to INSERT Cristina in Guadiana for dates >= 2026-10-12,
    // Cristina already exists in Cumbria for those same dates!
    // The constraint might be on (empleado_id, fecha) across ALL hotels, not (empleado_id, fecha, hotel_id)

    // Test: try to insert a single row
    const testDate = '2026-10-12';
    const res = await fetch(`${url}/rest/v1/turnos`, {
        method: 'POST',
        headers: { ...BASE_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify({
            empleado_id: 'Cristina',
            fecha: testDate,
            hotel_id: 'Sercotel Guadiana',
            turno: 'T',
            updated_by: 'TEST_DIAG'
        })
    });
    const data = await res.json();
    console.log('Test insert Cristina Guadiana 2026-10-12:', res.status, data);

    // Check exact constraint definition by inspecting conflicting rows
    const crisAll = await (await fetch(url+'/rest/v1/turnos?empleado_id=eq.Cristina&fecha=gte.2026-10-12&fecha=lte.2026-10-15&order=fecha.asc,hotel_id.asc', {headers: BASE_HEADERS})).json();
    console.log('\nAll Cristina rows Oct 12-15:', crisAll.map(r => ({fecha: r.fecha, hotel: r.hotel_id, turno: r.turno})));
}
main().catch(console.error);
