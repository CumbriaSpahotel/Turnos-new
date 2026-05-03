const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEventCreation() {
    console.log("--- EVENT CREATION CHECK ---");
    
    const { data: events, error: errEvents } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .eq('fecha_inicio', '2026-04-28')
        .eq('empleado_id', 'Sergio Sánchez')
        .neq('estado', 'anulado');

    if (errEvents) {
        console.error("Error:", errEvents);
        return;
    }

    events.forEach(ev => {
        console.log(`Event ID: ${ev.id} | Created At: ${ev.created_at}`);
    });
}

checkEventCreation();
