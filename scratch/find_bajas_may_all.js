const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findBajasMayAllHotels() {
    console.log("--- FINDING BAJAS/PERMISOS MAYO 2026 (ALL HOTELS) ---");
    
    const { data: events, error: errEvents } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .gte('fecha_inicio', '2026-05-01')
        .lte('fecha_inicio', '2026-05-31')
        .neq('estado', 'anulado')
        .in('tipo', ['BAJA', 'PERMISO', 'IT', 'FORMACION']);

    if (errEvents) {
        console.error("Error:", errEvents);
        return;
    }

    console.log(`Found ${events.length} medical/permission events in May.`);
    events.forEach(ev => {
        console.log(`- ${ev.fecha_inicio}: ${ev.tipo} | Hotel: ${ev.hotel} | Empleado: ${ev.empleado_id} | Sustituto: ${ev.empleado_destino_id || ev.sustituto_id}`);
    });
}

findBajasMayAllHotels();
