const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function forcePublish(hotel, weekStart) {
    console.log(`\n--- Forced Publication for ${hotel} (${weekStart}) ---`);
    
    // 1. Fetch latest version
    const { data: verData } = await client
        .from('publicaciones_cuadrante')
        .select('version')
        .eq('hotel', hotel)
        .eq('semana_inicio', weekStart)
        .order('version', { ascending: false })
        .limit(1);
    
    const nextVersion = (verData && verData[0]) ? verData[0].version + 1 : 1;
    console.log(`Next version: ${nextVersion}`);

    // 2. We need a valid snapshot. Since we are in node, we'll try to find the latest valid one and update it with latest events.
    // However, the best way is to let the ADMIN.JS do it correctly in the browser.
    
    // BUT! I suspect the browser failed because of RLS on UPDATE.
    // I already patched supabase-dao.js to handle RLS warning on UPDATE.
    
    console.log("Supabase-dao.js should now handle the RLS warning.");
}

// I'll use a different approach: check why the subagent's publication didn't show up in my check script.
// I'll check ALL snapshots for 2026-05-18 for Sercotel Guadiana.

async function checkAll() {
    const { data } = await client
        .from('publicaciones_cuadrante')
        .select('id, version, created_at, estado, semana_inicio')
        .eq('hotel', 'Sercotel Guadiana')
        .eq('semana_inicio', '2026-05-18')
        .order('created_at', { ascending: false });
    
    console.log(JSON.stringify(data, null, 2));
}

checkAll();
