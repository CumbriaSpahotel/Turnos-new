const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .select('id, version, created_at, snapshot_json')
        .eq('hotel', 'Cumbria Spa&Hotel')
        .eq('semana_inicio', '2026-05-11')
        .order('version', { ascending: false })
        .limit(10);
        
    if (error) {
        console.error(error);
        return;
    }
    
    console.log("Last 10 versions of Cumbria Spa&Hotel for week 2026-05-11:");
    data.forEach(v => {
        console.log(`Version: ${v.version}, Created: ${v.created_at}, Rows: ${v.snapshot_json?.rows?.length}`);
        console.log(`  Employees: ${v.snapshot_json?.rows?.map(r => r.nombre || r.empleado_id).join(', ')}`);
    });
}

run();
