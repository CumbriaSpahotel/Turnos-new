const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyCleanup() {
    console.log("--- POST-CLEANUP VERIFICATION START ---");

    // 1. Verificar duplicados activos
    console.log("\n[1] Multi-Active Check:");
    const { data: multi, error: err1 } = await client
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version')
        .eq('estado', 'activo');
    
    if (err1) console.error(err1);
    else {
        const groups = {};
        multi.forEach(r => {
            const k = `${r.hotel}|${r.semana_inicio}`;
            if (!groups[k]) groups[k] = [];
            groups[k].push(r.version);
        });
        const dups = Object.entries(groups).filter(([k, v]) => v.length > 1);
        if (dups.length === 0) console.log("Success: No multi-active versions found.");
        else {
            console.log(`Found ${dups.length} combinations with multi-active:`);
            dups.forEach(([k, v]) => console.log(` - ${k}: ${v.join(', ')}`));
        }
    }

    // 2. Verificar semanas críticas
    console.log("\n[2] Critical Weeks Status:");
    const { data: critical, error: err2 } = await client
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, version, estado, updated_at')
        .eq('hotel', 'Sercotel Guadiana')
        .in('semana_inicio', ['2026-05-18', '2026-06-01'])
        .order('semana_inicio', { ascending: true })
        .order('version', { ascending: false });
    
    if (err2) console.error(err2);
    else console.log(JSON.stringify(critical, null, 2));

    // 4. Validar claves internas
    console.log("\n[4] Internal Date Keys (Active Snapshots):");
    const { data: snapshots, error: err4 } = await client
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version, snapshot_json')
        .eq('hotel', 'Sercotel Guadiana')
        .in('semana_inicio', ['2026-05-18', '2026-06-01'])
        .eq('estado', 'activo');
    
    if (err4) console.error(err4);
    else {
        snapshots.forEach(s => {
            const row = s.snapshot_json.rows[0];
            const keys = Object.keys(row.turnosOperativos || row.cells || row.dias || {});
            console.log(`${s.hotel} | ${s.semana_inicio} | v${s.version} | Keys: ${keys.sort().join(', ')}`);
        });
    }

    console.log("\n--- POST-CLEANUP VERIFICATION END ---");
}

verifyCleanup();
