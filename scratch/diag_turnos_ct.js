const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diag() {
    console.log("--- BUSCANDO TURNOS TIPO CT/CAMBIO EN 06/04/2026 ---");
    const { data: turnos } = await supabase
        .from('turnos')
        .select('*')
        .eq('fecha', '2026-04-06')
        .or('tipo.ilike.%CT%,tipo.ilike.%CAMBIO%');

    turnos.forEach(t => {
        console.log(`[TURNO_CT] ${t.hotel_id} | ${t.empleado_id} | Turno: ${t.turno} | Tipo: ${t.tipo} | Sustituto: ${t.sustituto}`);
    });
}

diag();
