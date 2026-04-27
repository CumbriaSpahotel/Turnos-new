const fs = require('fs');

async function check() {
    const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1";
    const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

    const fetchSupabase = async (path, method = 'GET', body = null) => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const options = {
            method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) options.body = JSON.stringify(body);
        
        const response = await fetch(url.toString(), options);
        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`HTTP error! status: ${response.status} msg: ${txt}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    };

    try {
        const turnosV = await fetchSupabase("/turnos?turno=eq.V&select=id");
        console.log(`Total turnos 'V': ${turnosV.length}`);
        
        // Ejecutar actualización si quedan
        if (turnosV.length > 0) {
            console.log("Actualizando los restantes a '—'...");
            await fetchSupabase("/turnos?turno=eq.V", "PATCH", { turno: '—' });
            console.log("Completado.");
        }
        
    } catch (e) {
        console.error("Error:", e);
    }
}
check();
