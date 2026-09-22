const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function testPatch() {
    // 1. Insert dummy row
    const res1 = await fetch(`${url}/rest/v1/turnos`, {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({
            empleado_id: 'test_patch_worker',
            fecha: '2099-01-01',
            hotel_id: 'Cumbria Spa&Hotel',
            turno: 'M'
        })
    });
    console.log('Insert status:', res1.status);

    // 2. Patch dummy row
    const res2 = await fetch(`${url}/rest/v1/turnos?empleado_id=eq.test_patch_worker&fecha=eq.2099-01-01`, {
        method: 'PATCH',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({
            empleado_id: 'test_patch_worker_updated',
            turno: 'T'
        })
    });
    const patchData = await res2.json();
    console.log('Patch status:', res2.status, patchData);

    // 3. Clean up
    await fetch(`${url}/rest/v1/turnos?fecha=eq.2099-01-01`, {
        method: 'DELETE',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log('Cleaned up');
}

testPatch().catch(console.error);
