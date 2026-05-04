const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSnapshots() {
    console.log("Checking ALL recent snapshots...");
    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, version, estado, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    data.forEach(s => {
        console.log(`ID: ${s.id} | Hotel: ${s.hotel} | Week: ${s.semana_inicio} | Ver: ${s.version} | State: ${s.estado} | Created: ${s.created_at}`);
    });
}

checkSnapshots();
