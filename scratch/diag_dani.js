const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diag() {
    console.log("--- BUSCANDO EVENTOS DE DANI EN ABRIL ---");
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .or('empleado_id.ilike.%Dani%,empleado_destino_id.ilike.%Dani%')
        .gte('fecha_inicio', '2026-04-01')
        .lte('fecha_inicio', '2026-04-30');

    if (error) {
        console.error(error);
        return;
    }

    events.forEach(ev => {
        console.log(`[DANI_EVENT] ${ev.fecha_inicio} | ${ev.tipo} | ${ev.empleado_id} -> ${ev.empleado_destino_id} | Orig: ${ev.turno_original} | Nuevo: ${ev.turno_nuevo} | Estado: ${ev.estado}`);
    });

    console.log("--- BUSCANDO TURNOS DE DANI EN ABRIL ---");
    const { data: turnos, errorT } = await supabase
        .from('turnos')
        .select('*')
        .ilike('empleado_id', '%Dani%')
        .gte('fecha', '2026-04-01')
        .lte('fecha', '2026-04-30');

    turnos.forEach(t => {
        console.log(`[DANI_TURNO] ${t.fecha} | ${t.turno} | ${t.tipo}`);
    });
}

diag();
