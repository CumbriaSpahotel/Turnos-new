const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectNatalioSnap() {
    console.log("--- NATALIO SNAP INSPECTION ---");
    
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
    const data = snap.snapshot_json;
    const rows = Array.isArray(data) ? data : (data.rows || data.data || []);
    console.log(`Employees in snapshot (${rows.length}):`, rows.map(r => r.nombre).join(', '));
    
    const natalio = rows.find(row => row.nombre === 'Natalio');
    if (natalio) {
        console.log(`\nNatalio found in snapshot (Week ${snap.semana_inicio}):`);
        console.log(JSON.stringify(natalio, null, 2));
    } else {
        console.log(`\nNatalio not found in snapshot.`);
    }
}

inspectNatalioSnap();
