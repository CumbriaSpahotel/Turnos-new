const fs = require('fs');

async function checkTurnos() {
    const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
    const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

    const fetchSupabase = async (path, method = 'GET') => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const response = await fetch(url.toString(), {
            method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        return await response.json();
    };

    console.log("=== DB QUERY FOR WEEK 30/03/26 ===");
    const res = await fetchSupabase("/turnos?hotel_id=eq.Cumbria%20Spa%26Hotel&fecha=gte.2026-03-30&fecha=lte.2026-04-05&select=fecha,hotel_id,empleado_id,turno");
    if (!Array.isArray(res)) {
        console.error("Not an array:", res);
        return;
    }
    const filtered = res.filter(r => ['Cristina','Esther','Sergio','Valentín'].includes(r.empleado_id) && !r.empleado_id.includes('_DUP'));
    
    filtered.sort((a,b) => {
        if (a.empleado_id !== b.empleado_id) return a.empleado_id.localeCompare(b.empleado_id);
        return a.fecha.localeCompare(b.fecha);
    });
    
    filtered.forEach(r => console.log(`${r.fecha} | ${r.empleado_id} | ${r.turno}`));
}
checkTurnos();
