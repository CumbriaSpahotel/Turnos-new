const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDuplicates() {
    console.log("[DUPLICATE CHECK SERGIO 28/04]");
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .eq('fecha_inicio', '2026-04-28')
        .neq('estado', 'anulado');

    if (error) {
        console.error("Error:", error);
        return;
    }

    const cumbriaEvents = events.filter(ev => {
        const h = ev.hotel || ev.hotel_origen || '';
        return h.includes('Cumbria');
    });

    const sergioCumbria = cumbriaEvents.filter(ev => {
        const n = String(ev.empleado_id || '').toLowerCase();
        return n.includes('sergio');
    });

    console.log(`Found ${sergioCumbria.length} events for Sergio in Cumbria on 28/04.`);
    sergioCumbria.forEach(ev => {
        console.log(`- ID: ${ev.id}, Tipo: ${ev.tipo}`);
    });
}

checkDuplicates();
