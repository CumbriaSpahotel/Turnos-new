const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkCumbriaApril() {
    console.log("--- CUMBRIA APRIL SNAPSHOTS ---");
    
    const { data: snaps, error: errSnaps } = await supabase
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, version, created_at')
        .eq('hotel', 'Cumbria Spa&Hotel')
        .eq('semana_inicio', '2026-04-27')
        .order('version', { ascending: false });

    if (errSnaps) {
        console.error("Error:", errSnaps);
        return;
    }

    console.log(`Found ${snaps.length} snapshots for Cumbria week 2026-04-27.`);
    snaps.forEach(s => {
        console.log(`- Version: ${s.version} | Created: ${s.created_at}`);
    });
}

checkCumbriaApril();
