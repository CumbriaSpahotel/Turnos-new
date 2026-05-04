const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSnapshots() {
    console.log("Checking snapshots for Sercotel Guadiana...");
    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, version, estado, created_at, snapshot_json')
        .eq('hotel', 'Sercotel Guadiana')
        .in('semana_inicio', ['2026-05-18', '2026-06-01', '2026-05-04'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    data.forEach(s => {
        const firstRow = s.snapshot_json?.rows?.[0];
        const keys = firstRow ? Object.keys(firstRow.turnosOperativos || firstRow.cells || {}) : [];
        console.log(`ID: ${s.id} | Week: ${s.semana_inicio} | Ver: ${s.version} | State: ${s.estado} | Created: ${s.created_at} | FirstKeys: ${keys.slice(0, 3).join(', ')}...`);
    });
}

checkSnapshots();
