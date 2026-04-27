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

async function runValidation() {
    console.log('--- POST-REIMPORT SQL VALIDATION ---');

    // 1. Total turnos
    const total = await querySupabase('turnos?select=count');
    console.log('Total Turnos:', total);

    // 2. By Hotel
    const byHotel = await querySupabase('turnos?select=hotel_id,fecha');
    const hotelStats = {};
    const yearStats = {};
    
    byHotel.forEach(t => {
        hotelStats[t.hotel_id] = hotelStats[t.hotel_id] || { count: 0, min: t.fecha, max: t.fecha };
        hotelStats[t.hotel_id].count++;
        if (t.fecha < hotelStats[t.hotel_id].min) hotelStats[t.hotel_id].min = t.fecha;
        if (t.fecha > hotelStats[t.hotel_id].max) hotelStats[t.hotel_id].max = t.fecha;

        const year = t.fecha.slice(0, 4);
        yearStats[year] = (yearStats[year] || 0) + 1;
    });

    console.log('Stats by Hotel:', hotelStats);
    console.log('Stats by Year:', yearStats);

    // 3. Sample 2030
    const sample2030 = await querySupabase('turnos?select=fecha,hotel_id,empleado_id,turno&fecha=gte.2030-01-07&fecha=lte.2030-01-13&limit=5');
    console.log('Sample 2030:', sample2030);

    // 4. Sample 2036
    const sample2036 = await querySupabase('turnos?select=fecha,hotel_id,empleado_id,turno&fecha=gte.2036-12-08&fecha=lte.2036-12-15&limit=5');
    console.log('Sample 2036:', sample2036);

    console.log('--- VALIDATION COMPLETE ---');
}

runValidation().catch(console.error);
