const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diag() {
    console.log("--- EVENTOS GUADIANA SEMANA 06/04/2026 ---");
    const { data: events } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .gte('fecha_inicio', '2026-04-06')
        .lte('fecha_inicio', '2026-04-12');

    events.forEach(ev => {
        const hotel = ev.hotel_origen || ev.hotel_destino || ev.hotel || '';
        if (hotel.includes('Guadiana') || !hotel) {
            console.log(`[EVENT] ${ev.fecha_inicio} | ${ev.id} | ${ev.tipo} | ${ev.empleado_id} -> ${ev.empleado_destino_id} | Orig: ${ev.turno_original} | Nuevo: ${ev.turno_nuevo} | Estado: ${ev.estado}`);
        }
    });
}

diag();
