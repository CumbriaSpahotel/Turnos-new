const https = require('https');

const hotel = "Cumbria Spa&Hotel";
const weekStart = "2026-05-04";

async function fetchFromSupabase(table, query) {
    return new Promise((resolve, reject) => {
        const url = `https://drvmxranbpumianmlzqr.supabase.co/rest/v1/${table}?${query}`;
        const options = {
            headers: {
                'apikey': 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ',
                'Authorization': 'Bearer sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ'
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch(e) { 
                    console.log('Error parsing data:', data);
                    resolve([]); 
                }
            });
        }).on('error', reject);
    });
}

async function runDiagnostic() {
    try {
        const snaps = await fetchFromSupabase('publicaciones_cuadrante', `semana_inicio=eq.${weekStart}&hotel=eq.${encodeURIComponent(hotel)}&order=version.desc&limit=1`);
        const snap = snaps[0];
        
        if (snap) {
            console.log(`Snapshot V${snap.version} ID: ${snap.id}`);
            const rows = (snap.data || {}).rows || [];
            console.log(`Total Rows: ${rows.length}`);
            rows.forEach(r => {
                if (r.nombre && (r.nombre.includes('Sergio') || r.nombre.includes('Miriam'))) {
                    console.log(`FOUND: ${r.nombre} | PO: ${r.puestoOrden} | Type: ${r.rowType}`);
                }
            });
        }
        
        const evs = await fetchFromSupabase('eventos_cuadrante', `fecha_inicio=gte.${weekStart}&fecha_inicio=lte.2026-05-10&hotel_id=eq.${encodeURIComponent(hotel)}`);
        if (Array.isArray(evs)) {
            console.log(`Total Events: ${evs.length}`);
            evs.forEach(e => {
                if (e.empleado_id && (e.empleado_id.includes('Sergio') || e.empleado_id.includes('Miriam'))) {
                    console.log(`EVENT: ${e.tipo} | Emp: ${e.empleado_id} | Dest: ${e.empleado_destino_id || e.sustituto_id}`);
                }
            });
        } else {
            console.log('Events is not an array:', evs);
        }
        
    } catch (e) {
        console.error('Error:', e);
    }
}

runDiagnostic();
