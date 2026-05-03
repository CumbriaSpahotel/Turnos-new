const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSnapshots() {
    console.log("--- SNAPSHOTS AUDIT ---");
    
    const { data: snaps, error: errSnaps } = await supabase
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, semana_fin, version, created_at')
        .order('version', { ascending: false })
        .limit(20);

    if (errSnaps) {
        console.error("Error:", errSnaps);
        return;
    }

    console.log(`Found ${snaps.length} recent snapshots.`);
    snaps.forEach(s => {
        console.log(`- ${s.hotel} | Week: ${s.semana_inicio} | Version: ${s.version} | Created: ${s.created_at}`);
    });
}

checkSnapshots();
