const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkVersionColumn() {
    console.log("[VERSION COLUMN CHECK]");
    const { data: snaps, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    const version = snaps[0].version;
    console.log(`Version value: ${version}, Type: ${typeof version}`);
}

checkVersionColumn();
