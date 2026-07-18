const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const buildFingerprint = (rows) => {
    const fp = {};
    (rows || []).forEach(row => {
        const empId = row.empleado_id || row.employee_id || row.nombre || '';
        if (!empId) return;
        const daysCodes = Object.entries(row.dias || {}).map(([f, d]) => `${f}:${d.code || d.turno || ''}`).sort().join(',');
        fp[empId] = daysCodes;
    });
    return fp;
};

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
        console.log("LAST SNAPSHOT:");
        const fp = buildFingerprint(last.snapshot_json.rows);
        console.log(JSON.stringify(fp, null, 2));

        // Now let's simulate newSnap by using the same snapshot_json we fetched, but modifying it to see how they differ.
        // Wait, what if we run it on the raw snapshot rows?
        console.log("\nComparing saved rows directly against themselves:");
        const oldFP = buildFingerprint(last.snapshot_json.rows);
        const newFP = buildFingerprint(last.snapshot_json.rows);
        const changes = Object.keys(newFP).filter(id => newFP[id] !== oldFP[id]);
        console.log(`Changes: ${changes.length}`);
    }
}

run();
