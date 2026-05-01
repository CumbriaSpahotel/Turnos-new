const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diag() {
    console.log("--- TODOS LOS EVENTOS EN GUADIANA 06/04/2026 ---");
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .eq('fecha_inicio', '2026-04-06');

    events.forEach(ev => {
        const hotel = ev.hotel_origen || ev.hotel_destino || ev.hotel || '';
        if (hotel.includes('Guadiana') || !hotel) {
            console.log(`[EVENT] ${ev.id} | ${ev.tipo} | ${ev.empleado_id} -> ${ev.empleado_destino_id} | Orig: ${ev.turno_original} | Nuevo: ${ev.turno_nuevo} | Estado: ${ev.estado}`);
        }
    });
}

diag();
