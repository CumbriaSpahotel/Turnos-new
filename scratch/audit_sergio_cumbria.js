const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function auditSergioCumbria() {
    console.log("[SERGIO CUMBRIA EVENT AUDIT]");
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .eq('empleado_id', 'Sergio')
        .gte('fecha_inicio', '2026-04-20')
        .lte('fecha_inicio', '2026-05-10')
        .neq('estado', 'anulado');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${events.length} events for 'Sergio' (Cumbria):`);
    events.forEach(ev => {
        console.log(`- ${ev.fecha_inicio}: ${ev.tipo} | Hotel: ${ev.hotel_origen} | Sustituto: ${ev.empleado_destino_id}`);
    });
}

auditSergioCumbria();
