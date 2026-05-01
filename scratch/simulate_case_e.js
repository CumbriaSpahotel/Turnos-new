const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

async function simulate() {
    const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const date = '2026-04-06';
    const hotel = 'Sercotel Guadiana';

    const { data: events } = await supabase.from('eventos_cuadrante').select('*').gte('fecha_inicio', date).lte('fecha_inicio', date);
    const { data: turnos } = await supabase.from('turnos').select('*').eq('fecha', date);

    const baseIndex = new Map();
    turnos.forEach(t => {
        if (t.hotel_id?.includes('Guadiana')) {
            baseIndex.set(t.empleado_id.toLowerCase().trim(), t.turno);
        }
    });

    console.log("--- SIMULACION GUADIANA 06/04/26 ---");
    const targets = ['dani', 'diana', 'macarena'];
    
    targets.forEach(name => {
        console.log(`\nResolviendo ${name}:`);
        const base = baseIndex.get(name) || '—';
        console.log(`  Base: ${base}`);
        
        const activeEvents = (events || []).filter(ev => {
            const tId = String(ev.empleado_id || '').toLowerCase().trim();
            const dId = String(ev.empleado_destino_id || '').toLowerCase().trim();
            const h = ev.hotel_origen || ev.hotel_destino || '';
            return (tId === name || dId === name) && (h.includes('Guadiana') || !h);
        });

        activeEvents.forEach(ev => {
            console.log(`  Evento: ${ev.tipo} | ${ev.empleado_id} -> ${ev.empleado_destino_id} | Orig: ${ev.turno_original} | Nuevo: ${ev.turno_nuevo}`);
        });
    });
}

simulate();
