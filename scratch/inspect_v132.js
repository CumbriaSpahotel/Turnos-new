const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectV132() {
    console.log("[INSPECTING V132 CUMBRIA MAY]");
    const { data: snaps, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('hotel', 'Cumbria Spa&Hotel')
        .eq('semana_inicio', '2026-05-04')
        .eq('version', 132)
        .limit(1);

    if (error || !snaps.length) {
        console.error("Error or no snap:", error);
        return;
    }

    const snap = snaps[0];
    const rows = snap.snapshot_json.rows || [];
    const miriam = rows.find(r => String(r.nombre).includes('Miriam'));
    
    if (miriam) {
        console.log("Miriam Row found in V132:");
        const cell04 = (miriam.cells || miriam.dias || {})['2026-05-04'];
        console.log("Miriam May 04:", JSON.stringify(cell04));
    } else {
        console.log("Miriam not found in V132.");
    }

    const sergio = rows.find(r => String(r.nombre).includes('Sergio'));
    if (sergio) {
        console.log("Sergio ID in V132:", sergio.empleado_id);
    }
}

inspectV132();
