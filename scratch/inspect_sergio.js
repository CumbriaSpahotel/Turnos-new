const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectSergioSnap() {
    console.log("--- SERGIO SNAP INSPECTION (APRIL 27) ---");
    
    const { data: snaps, error: errSnaps } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('hotel', 'Cumbria Spa&Hotel')
        .eq('semana_inicio', '2026-04-27')
        .order('version', { ascending: false })
        .limit(1);

    if (errSnaps || !snaps || snaps.length === 0) {
        console.error("Error or no snaps:", errSnaps);
        return;
    }

    const snap = snaps[0];
    const data = snap.snapshot_json;
    const rows = Array.isArray(data) ? data : (data.rows || data.data || []);
    
    const sergio = rows.find(row => row.nombre === 'Sergio' || row.nombre === 'Sergio Sánchez');
    if (sergio) {
        console.log(`\nSergio found in snapshot:`);
        console.log(`nombre: ${sergio.nombre}`);
        console.log(`empleado_id: ${sergio.empleado_id}`);
        console.log(`titularOriginalId: ${sergio.titularOriginalId}`);
    } else {
        console.log(`\nSergio not found in snapshot.`);
    }
}

inspectSergioSnap();
