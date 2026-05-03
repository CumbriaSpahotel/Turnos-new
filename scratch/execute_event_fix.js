const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function executeEventFix() {
    console.log("[EVENT FIX EXECUTION]");
    const targetId = 'e2e67f27-fa94-46a0-80b2-34a8c44d949f';
    
    // 1. Re-confirm ID and details before update
    const { data: before, error: errFetch } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .eq('id', targetId);

    if (errFetch || !before.length) {
        console.error("Critical: Event not found or fetch error.", errFetch);
        return;
    }

    const ev = before[0];
    const isSergioS = ev.empleado_id === 'Sergio Sánchez';
    const isPermiso = ev.tipo === 'PERMISO';
    const isDate = ev.fecha_inicio === '2026-04-28';
    const isNatalio = (ev.empleado_destino_id || ev.sustituto_id) === 'Natalio';

    if (!isSergioS || !isPermiso || !isDate || !isNatalio) {
        console.error("Critical: Pre-update verification failed.", { isSergioS, isPermiso, isDate, isNatalio });
        return;
    }

    console.log("Pre-update verification: OK.");
    console.log("Updating hotel_origen from 'Sercotel Guadiana' to 'Cumbria Spa&Hotel'...");

    // 2. Execute Update
    const { data: updated, error: errUpdate } = await supabase
        .from('eventos_cuadrante')
        .update({ hotel_origen: 'Cumbria Spa&Hotel' })
        .eq('id', targetId)
        .select();

    if (errUpdate) {
        console.error("Error executing update:", errUpdate);
        return;
    }

    console.log("Update executed successfully.");
    console.log("Final Record:", JSON.stringify(updated[0], null, 2));
}

executeEventFix();
