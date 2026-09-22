const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function testFK() {
    // Try inserting a dummy turno in far future (2099-01-01) with empleado_id = 'test_dummy_vacante'
    const res = await fetch(`${url}/rest/v1/turnos`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            empleado_id: 'test_dummy_vacante',
            fecha: '2099-01-01',
            hotel_id: 'Cumbria Spa&Hotel',
            turno: 'M'
        })
    });
    const data = await res.json();
    console.log('Insert test result:', res.status, data);

    if (res.status === 201 || (Array.isArray(data) && data.length > 0)) {
        // Clean up
        await fetch(`${url}/rest/v1/turnos?empleado_id=eq.test_dummy_vacante&fecha=eq.2099-01-01`, {
            method: 'DELETE',
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        console.log('Cleaned up test row');
    }
}

testFK().catch(console.error);
