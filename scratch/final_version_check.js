const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function finalVersionCheck() {
    console.log("[FINAL VERSION CHECK]");
    const weeks = ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];
    
    const { data: snaps, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version')
        .in('semana_inicio', weeks)
        .eq('estado', 'activo');

    if (error) {
        console.error("Error:", error);
        return;
    }

    const maxByWeek = {};
    snaps.forEach(s => {
        const week = s.semana_inicio;
        if (!maxByWeek[week]) maxByWeek[week] = 0;
        if (s.version > maxByWeek[week]) maxByWeek[week] = s.version;
    });

    console.log("Max Versions found:");
    for (const week in maxByWeek) {
        console.log(`- Week ${week}: ${maxByWeek[week]}`);
    }

    const absoluteMax = Math.max(...snaps.map(s => s.version));
    console.log(`Absolute Max Version in database for these weeks: ${absoluteMax}`);
    console.log(`Proposed Technical Version: ${absoluteMax + 1}`);
}

finalVersionCheck();
