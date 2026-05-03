const fs = require('fs');

async function check() {
    try {
        const configText = fs.readFileSync('supabase-config.js', 'utf8');
        const urlMatch = configText.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
        const keyMatch = configText.match(/SUPABASE_KEY\s*=\s*['"]([^'"]+)['"]/);
        if(!urlMatch || !keyMatch) {
            console.log("No config");
            return;
        }
        const SUPABASE_URL = urlMatch[1];
        const SUPABASE_KEY = keyMatch[1];
        
        const res = await fetch(SUPABASE_URL + '/rest/v1/publicaciones_cuadrante?hotel=eq.Sercotel%20Guadiana&semana_inicio=eq.2026-04-27&select=*&order=version.desc&limit=1', {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            }
        });
        const data = await res.json();
        if(!data || data.length === 0) { console.log('No snapshot found'); return; }
        const snap = data[0];
        console.log('Version:', snap.version);
        const emps = snap.snapshot_json.empleados || snap.snapshot_json.rows || [];
        const sergio = emps.find(e => (e.nombre||e.nombreVisible||'').includes('Sergio'));
        console.log('Sergio:', JSON.stringify(sergio, null, 2));
        console.log('Ordem en snapshot:');
        emps.forEach((e, i) => console.log(i+1 + '.', e.nombreVisible || e.nombre, 'orden:', e.orden, 'puestoOrden:', e.puestoOrden));
    } catch(e) {
        console.error(e);
    }
}
check();
