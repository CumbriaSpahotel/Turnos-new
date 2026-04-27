const https = require('https');

const API_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const BASE_URL = 'drvmxranbpumianmlzqr.supabase.co';

async function querySupabase(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: `/rest/v1/${path}`,
            headers: { 'apikey': API_KEY }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { 
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function runAudit() {
    console.log('--- POST-IMPORT AUDIT ---');

    // 1. Total turnos
    const totalTurnos = await querySupabase('turnos?select=count');
    console.log('Total Turnos:', totalTurnos);

    // 2. Turnos by hotel (filtered)
    const turnosByHotel = await querySupabase('turnos?select=hotel_id&fecha=lte.2026-12-31');
    const hotelCounts = {};
    turnosByHotel.forEach(t => {
        hotelCounts[t.hotel_id] = (hotelCounts[t.hotel_id] || 0) + 1;
    });
    console.log('Turnos by Hotel (<=2026):', hotelCounts);

    // 3. Turnos for week 20/04/2026
    const weekTurnos = await querySupabase('turnos?select=fecha,hotel_id&fecha=gte.2026-04-20&fecha=lte.2026-04-26');
    const weekCounts = {};
    weekTurnos.forEach(t => {
        const key = `${t.fecha}|${t.hotel_id}`;
        weekCounts[key] = (weekCounts[key] || 0) + 1;
    });
    console.log('Week 20/04/2026 counts:', weekCounts);

    // 4. Events by type
    const events = await querySupabase('eventos_cuadrante?select=tipo');
    const eventCounts = {};
    events.forEach(e => {
        const t = e.tipo.toUpperCase();
        eventCounts[t] = (eventCounts[t] || 0) + 1;
    });
    console.log('Events by Type:', eventCounts);

    // 5. Check "Ignored" dates
    // I'll check if there are any dates > 2026 in the DB that I MIGHT have inserted by mistake
    const futureTurnos = await querySupabase('turnos?select=fecha&fecha=gt.2026-12-31&limit=5');
    console.log('Sample Future Turnos in DB:', futureTurnos);

    console.log('--- AUDIT COMPLETE ---');
}

runAudit().catch(console.error);
