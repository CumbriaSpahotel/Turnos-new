const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const targetWeeks = ['2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25'];
const targetHotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

async function validate() {
    console.log("--- VALIDATION POST-PUBLICATION ---");
    
    // 1. SELECT all relevant snapshots
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, version, estado, created_at')
        .in('hotel', targetHotels)
        .in('semana_inicio', targetWeeks)
        .order('hotel', { ascending: true })
        .order('semana_inicio', { ascending: true })
        .order('version', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${data.length} snapshots total for target scope.`);
    
    // Check for V2 (the ones we just inserted)
    const v2Count = data.filter(r => r.version === 2).length;
    console.log(`New V2 snapshots: ${v2Count}/8`);

    // Detect duplicates (more than one 'activo' per hotel/week)
    const activeSummary = {};
    data.filter(r => r.estado === 'activo').forEach(r => {
        const key = `${r.semana_inicio} | ${r.hotel}`;
        if (!activeSummary[key]) activeSummary[key] = [];
        activeSummary[key].push(r.version);
    });

    console.log("\nDuplicates detecting (Active versions per scope):");
    let hasDuplicates = false;
    Object.keys(activeSummary).forEach(key => {
        const versions = activeSummary[key];
        console.log(`${key}: ${versions.join(', ')}`);
        if (versions.length > 1) hasDuplicates = true;
    });

    if (hasDuplicates) {
        console.log("\n[ACTION] Manual Cleanup Required via SQL Editor.");
    } else {
        console.log("\n[OK] No duplicates detected.");
    }

    // 2. Validate Keys for one sample (V2)
    const sample = data.find(r => r.version === 2);
    if (sample) {
        const { data: fullSnap } = await supabase
            .from('publicaciones_cuadrante')
            .select('snapshot_json')
            .eq('id', sample.id)
            .single();
        
        const row = fullSnap.snapshot_json.rows[0];
        const keys = Object.keys(row.cells || row.turnosOperativos || {});
        console.log(`\nSample Validation (${sample.hotel} | ${sample.semana_inicio}):`);
        console.log(`Rows count: ${fullSnap.snapshot_json.rows.length}`);
        console.log(`Keys: ${keys.join(', ')}`);
    }
}

validate();
