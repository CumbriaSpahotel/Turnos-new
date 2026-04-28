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
                    resolve(JSON.parse(data));
                } catch(e) { resolve([]); }
            });
        }).on('error', reject);
    });
}

async function check() {
    try {
        console.log('--- BUSCANDO EVENTOS SERGIO/MIRIAM ---');
        // Fetch all events for the week and filter locally
        const evs = await fetchFromSupabase('eventos_cuadrante', `fecha_inicio=gte.${weekStart}&fecha_inicio=lte.2026-05-10`);
        
        if (!Array.isArray(evs)) {
            console.log('Error al obtener eventos:', evs);
            return;
        }

        const sergioEvs = evs.filter(e => e.empleado_id && e.empleado_id.includes('Sergio'));
        const miriamEvs = evs.filter(e => 
            (e.empleado_id && e.empleado_id.includes('Miriam')) || 
            (e.empleado_destino_id && e.empleado_destino_id.includes('Miriam')) ||
            (e.sustituto_id && e.sustituto_id.includes('Miriam'))
        );

        console.log('Eventos Sergio:', JSON.stringify(sergioEvs, null, 2));
        console.log('Eventos Miriam:', JSON.stringify(miriamEvs, null, 2));

    } catch (e) {
        console.error(e);
    }
}

check();
