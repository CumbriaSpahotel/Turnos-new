const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEvents() {
    const hotel = "Sercotel Guadiana";
    const week = "2026-06-01";
    
    console.log(`Checking events for ${hotel} | ${week}...`);
    
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .neq('estado', 'anulado')
        .or(`fecha_inicio.gte.${week},fecha_fin.gte.${week}`)
        .order('fecha_inicio', { ascending: true });
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    // Filter for Dani (dani)
    const daniEvents = events.filter(e => 
        String(e.empleado_id).toLowerCase().includes('dani') || 
        String(e.participante_a).toLowerCase().includes('dani') ||
        String(e.participante_b).toLowerCase().includes('dani')
    );
    
    console.log('\nDani Events:');
    daniEvents.forEach(e => {
        console.log(`- ID: ${e.id} | Tipo: ${e.tipo} | Desde: ${e.fecha_inicio} | Hasta: ${e.fecha_fin} | Sustituto: ${e.empleado_destino_id || e.sustituto_id || e.participante_b}`);
    });
}

checkEvents();
