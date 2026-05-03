const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listSnapshots() {
    console.log("[V8 PUBLICATION PRE-CHECK]");
    const weeks = ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];
    
    const { data: snaps, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version, estado')
        .in('semana_inicio', weeks)
        .order('semana_inicio', { ascending: true })
        .order('hotel', { ascending: true })
        .order('version', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${snaps.length} snapshots for the target weeks.`);
    snaps.forEach(s => {
        console.log(`- ${s.semana_inicio} | ${s.hotel} | Version: ${s.version} | Status: ${s.estado}`);
    });
}

listSnapshots();
