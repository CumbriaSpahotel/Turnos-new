const https = require('https');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function fetchFromSupabase(table, query) {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
        const options = {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
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

async function auditExisting() {
    console.log('--- AUDITANDO SNAPSHOTS EXISTENTES Q1 2026 ---');
    // Q1: 2026-01-01 a 2026-03-31
    const snaps = await fetchFromSupabase('publicaciones_cuadrante', 'semana_inicio=gte.2026-01-01&semana_inicio=lte.2026-03-31&order=semana_inicio.asc,created_at.desc');
    
    if (!Array.isArray(snaps) || snaps.length === 0) {
        console.log('No se encontraron snapshots para Q1 2026.');
        return;
    }

    console.log(`Encontrados ${snaps.length} registros de publicación.`);
    const table = snaps.map(s => ({
        hotel: s.hotel || s.hotel_id,
        inicio: s.semana_inicio,
        version: s.metadata?.version_builder || 'N/A',
        source: s.source || 'N/A',
        fecha: s.created_at ? s.created_at.slice(0, 10) : 'N/A'
    }));
    console.table(table);
}

auditExisting();
