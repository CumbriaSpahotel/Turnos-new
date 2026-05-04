const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEvents() {
    const hotel = "Sercotel Guadiana";
    const week = "2026-06-01";
    
    console.log(`Checking events for ${hotel} | week of ${week}...`);
    
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .neq('estado', 'anulado')
        .gte('fecha_inicio', '2026-06-01')
        .lte('fecha_inicio', '2026-06-07')
        .order('fecha_inicio', { ascending: true });
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log(`Total events found: ${events.length}`);
    events.forEach(e => {
        console.log(`- ID: ${e.id} | Tipo: ${e.tipo} | Desde: ${e.fecha_inicio} | Titular: ${e.empleado_id} | Destino: ${e.empleado_destino_id || e.sustituto_id || e.participante_b}`);
    });
}

checkEvents();
