const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diag() {
    console.log("--- DIAGNOSTICO EVENTOS CUADRANTE ---");
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .gte('fecha_inicio', '2026-04-01')
        .lte('fecha_inicio', '2026-04-30');

    if (error) {
        console.error("Error fetching events:", error);
        return;
    }

    console.log(`Encontrados ${events.length} eventos en Abril 2026.`);
    events.forEach(ev => {
        console.log(`[EVENT] ${ev.fecha_inicio} | ${ev.tipo} | ${ev.empleado_id} -> ${ev.empleado_destino_id} | Orig: ${ev.turno_original} | Nuevo: ${ev.turno_nuevo} | Estado: ${ev.estado} | Hotel: ${ev.hotel_origen || ev.hotel_destino}`);
    });
}

diag();
