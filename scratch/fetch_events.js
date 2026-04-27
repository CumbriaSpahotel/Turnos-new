const fs = require('fs');

async function fetchEvents() {
    const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1/eventos_cuadrante?select=*";
    const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

    try {
        const response = await fetch(SUPABASE_URL, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await response.json();
        
        const diana = data.filter(e => e.empleado_id === 'Diana' || JSON.stringify(e).includes('Diana'));
        const sergio = data.filter(e => e.empleado_id === 'Sergio Sánchez' || JSON.stringify(e).includes('Sergio Sánchez'));
        const ct = data.filter(e => JSON.stringify(e).includes('Dani') && JSON.stringify(e).includes('Macarena'));

        fs.writeFileSync('scratch/events_dump.json', JSON.stringify({
            diana: diana,
            sergio: sergio,
            ct: ct
        }, null, 2));

        console.log("Done");
    } catch (e) {
        console.error(e);
    }
}
fetchEvents();
