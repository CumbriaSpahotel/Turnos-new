const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function auditMay() {
    console.log("--- AUDIT MAYO 2026 ---");
    
    // 1. Fetch events for May 2026
    const { data: events, error: errEvents } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .gte('fecha_inicio', '2026-05-01')
        .lte('fecha_inicio', '2026-05-31')
        .neq('estado', 'anulado');

    if (errEvents) {
        console.error("Error fetching events:", errEvents);
        return;
    }

    console.log(`Found ${events.length} active events in May.`);

    // 2. Filter coverage/substitution events
    const coverages = events.filter(ev => {
        const t = (ev.tipo || '').toUpperCase();
        return t.includes('SUSTITUCION') || t.includes('COBERTURA') || ev.sustituto_id || ev.empleado_destino_id;
    });

    console.log(`\nCoverage Events (${coverages.length}):`);
    coverages.forEach(ev => {
        console.log(`- ${ev.fecha_inicio} to ${ev.fecha_fin || ev.fecha_inicio}: ${ev.tipo} | Titular: ${ev.empleado_id} | Sustituto: ${ev.empleado_destino_id || ev.sustituto_id}`);
    });

    // 3. Check for specific cases mentioned in project status
    // Natalio (covering PERMISO) -> Should show PIN
    // Miriam (covering VACACIONES) -> Should NOT show PIN
    
    const natalioEvents = events.filter(ev => {
        const sust = String(ev.empleado_destino_id || ev.sustituto_id || '').toLowerCase();
        return sust.includes('natalio');
    });
    
    console.log(`\nNatalio Events (${natalioEvents.length}):`);
    natalioEvents.forEach(ev => {
        console.log(`- ${ev.fecha_inicio}: ${ev.tipo} | Titular: ${ev.empleado_id}`);
    });

    const miriamEvents = events.filter(ev => {
        const sust = String(ev.empleado_destino_id || ev.sustituto_id || '').toLowerCase();
        return sust.includes('miriam');
    });
    
    console.log(`\nMiriam Events (${miriamEvents.length}):`);
    miriamEvents.forEach(ev => {
        console.log(`- ${ev.fecha_inicio}: ${ev.tipo} | Titular: ${ev.empleado_id}`);
    });
}

auditMay();
