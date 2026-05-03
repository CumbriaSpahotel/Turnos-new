const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function auditSergio28() {
    console.log("[SERGIO 28/04 EVENT AUDIT]");
    
    // Buscar eventos del 28/04/2026 relacionados con Sergio o Natalio
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .gte('fecha_inicio', '2026-04-01') // Rango amplio para capturar eventos que cubren el 28
        .lte('fecha_inicio', '2026-05-10')
        .neq('estado', 'anulado');

    if (error) {
        console.error("Error:", error);
        return;
    }

    const targetDate = '2026-04-28';
    const relevant = events.filter(ev => {
        const start = ev.fecha_inicio;
        const end = ev.fecha_fin || ev.fecha_inicio;
        const matchesDate = targetDate >= start && targetDate <= end;
        if (!matchesDate) return false;

        const names = [
            ev.empleado_id, 
            ev.empleado_nombre, 
            ev.sustituto_id, 
            ev.empleado_destino_id,
            ev.participante_a,
            ev.participante_b
        ].map(n => String(n || '').toLowerCase());

        return names.some(n => n.includes('sergio') || n.includes('natalio'));
    });

    console.log(`Found ${relevant.length} relevant events for 28/04:`);
    relevant.forEach(ev => {
        console.log(`\n--- Event ID: ${ev.id || ev.evento_id} ---`);
        console.log(`empleado_id: ${ev.empleado_id}`);
        console.log(`empleado_nombre: ${ev.empleado_nombre}`);
        console.log(`hotel_id: ${ev.hotel_id}`);
        console.log(`hotel_nombre: ${ev.hotel}`);
        console.log(`fecha_inicio: ${ev.fecha_inicio}`);
        console.log(`fecha_fin: ${ev.fecha_fin}`);
        console.log(`tipo_evento: ${ev.tipo}`);
        console.log(`estado: ${ev.estado}`);
        console.log(`sustituto_id: ${ev.sustituto_id || ev.empleado_destino_id}`);
        console.log(`observaciones: ${ev.observaciones}`);
        console.log(`payload: ${JSON.stringify(ev.payload)}`);
        console.log(`source: ${ev.source || 'N/A'}`);
        console.log(`created_at: ${ev.created_at}`);
        console.log(`updated_at: ${ev.updated_at}`);
    });

    // Auditoría de Empleado (Hotel actual de Sergio y Natalio en la ficha)
    const { data: emps } = await supabase.from('empleados').select('*');
    const sergio = emps.find(e => e.nombre.includes('Sergio'));
    const natalio = emps.find(e => e.nombre.includes('Natalio'));

    console.log(`\n[EMPLOYEE DATA]`);
    if (sergio) console.log(`Sergio: ID=${sergio.id}, Hotel=${sergio.hotel}`);
    if (natalio) console.log(`Natalio: ID=${natalio.id}, Hotel=${natalio.hotel}`);
}

auditSergio28();
