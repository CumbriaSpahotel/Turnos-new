const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectLatestSnap() {
    console.log("--- LATEST SNAP INSPECTION ---");
    
    const { data: snaps, error: errSnaps } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('hotel', 'Cumbria Spa&Hotel')
        .eq('semana_inicio', '2026-05-04')
        .order('version', { ascending: false })
        .limit(1);

    if (errSnaps || !snaps || snaps.length === 0) {
        console.error("Error or no snaps:", errSnaps);
        return;
    }

    const snap = snaps[0];
    console.log(`Hotel: ${snap.hotel}, Week: ${snap.semana_inicio}, Version: ${snap.version}`);
    console.log(`Resumen:`, JSON.stringify(snap.resumen, null, 2));
    
    // Check for Natalio or Miriam in the snapshot
    const data = snap.snapshot_json;
    console.log("Snapshot type:", typeof data);
    console.log("Keys in snapshot:", Object.keys(data));
    
    const rows = Array.isArray(data) ? data : (data.rows || data.data || []);
    const miriam = rows.find(row => row.nombre === 'Miriam');
    if (miriam) {
        console.log(`\nMiriam found in snapshot:`);
        console.log(JSON.stringify(miriam, null, 2));
    } else {
        console.log(`\nMiriam not found in snapshot.`);
    }
}

inspectLatestSnap();
