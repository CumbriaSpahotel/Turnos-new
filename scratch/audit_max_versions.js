const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function countVersions() {
    console.log("[V8 VERSION AUDIT]");
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

    const map = {};
    snaps.forEach(s => {
        const key = `${s.semana_inicio} | ${s.hotel}`;
        if (!map[key]) map[key] = [];
        map[key].push(s.version);
    });

    for (const key in map) {
        const max = Math.max(...map[key]);
        console.log(`${key} -> Max Version: ${max} (Total: ${map[key].length})`);
    }
}

countVersions();
