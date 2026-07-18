const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data: events, error } = await client
        .from('eventos_cuadrante')
        .select('*')
        .lte('fecha_inicio', '2026-05-17')
        .gte('fecha_fin', '2026-05-11');
        
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(`Found ${events.length} events:`);
    events.forEach(e => {
        console.log(`ID: ${e.id}, Tipo: ${e.tipo}, Empleado: ${e.empleado_id}, Destino/Sustituto: ${e.empleado_destino_id || e.sustituto_id || e.sustituto || e.payload?.sustituto || e.payload?.sustituto_id}, Estado: ${e.estado}`);
        console.log(`  Dates: ${e.fecha_inicio} to ${e.fecha_fin}`);
        console.log(`  Hotel Origen: ${e.hotel_origen || e.hotel_id || e.hotel}, Hotel Destino: ${e.hotel_destino}`);
    });
}

run();
