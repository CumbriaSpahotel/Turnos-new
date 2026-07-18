const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('semana_inicio', '2026-05-11')
        .eq('hotel', 'Cumbria Spa&Hotel')
        .order('version', { ascending: false });
    
    if (error) {
        console.error(error);
        return;
    }
    
    if (data.length > 0) {
        const last = data[0];
        console.log(`Version: ${last.version}`);
        last.snapshot_json.rows.forEach(r => {
            console.log(`\nEmployee: ${r.nombre || r.empleado_id} (rowType: ${r.rowType})`);
            Object.entries(r.dias || r.cells).forEach(([fecha, d]) => {
                console.log(`  ${fecha}: code=${d.code}, label=${d.label}, origen=${d.origen || d.type}, titular=${d.titular_cubierto}`);
            });
        });
    }
}

run();
