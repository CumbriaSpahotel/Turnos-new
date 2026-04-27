const fs = require('fs');

async function testQuery() {
    const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1/turnos?select=*&fecha=gte.2026-04-01&fecha=lte.2026-04-30";
    const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

    try {
        const response = await fetch(SUPABASE_URL, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await response.json();
        
        const total = data.length;
        const cumbria = data.filter(r => r.hotel_id === 'Cumbria Spa&Hotel').length;
        const sercotel = data.filter(r => r.hotel_id === 'Sercotel Guadiana').length;

        console.log(`Total Abril 2026: ${total}`);
        console.log(`Cumbria: ${cumbria}`);
        console.log(`Sercotel: ${sercotel}`);

    } catch (e) {
        console.error(e);
    }
}
testQuery();
