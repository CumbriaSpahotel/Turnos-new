const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runAudit() {
    console.log("--- FINAL AUDIT START ---");

    // 1. Validar publicaciones creadas
    console.log("\n[1] Snapshot Records:");
    const { data: records, error: err1 } = await client
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, semana_fin, version, estado, fecha_publicacion, created_at, updated_at')
        .eq('hotel', 'Sercotel Guadiana')
        .in('semana_inicio', ['2026-05-18', '2026-06-01'])
        .order('semana_inicio', { ascending: true })
        .order('version', { ascending: false });
    
    if (err1) console.error(err1);
    else console.log(JSON.stringify(records, null, 2));

    // 2. Validar claves internas
    console.log("\n[2] Internal Date Keys:");
    const { data: snapshots, error: err2 } = await client
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, version, snapshot_json')
        .eq('hotel', 'Sercotel Guadiana')
        .in('semana_inicio', ['2026-05-18', '2026-06-01'])
        .in('version', [10000, 142]);
    
    if (err2) console.error(err2);
    else {
        snapshots.forEach(s => {
            const row = s.snapshot_json.rows[0];
            const keys = Object.keys(row.turnosOperativos || row.cells || row.dias || {});
            console.log(`${s.hotel} | ${s.semana_inicio} | v${s.version} | Keys: ${keys.sort().join(', ')}`);
        });
    }

    // 3. Investigar Version 10000
    console.log("\n[3] Version Distribution (2026-05-18):");
    const { data: verDist, error: err3 } = await client
        .from('publicaciones_cuadrante')
        .select('version, fecha_publicacion')
        .eq('hotel', 'Sercotel Guadiana')
        .eq('semana_inicio', '2026-05-18')
        .order('version', { ascending: false });
    
    if (err3) console.error(err3);
    else {
        const counts = {};
        verDist.forEach(v => {
            counts[v.version] = (counts[v.version] || 0) + 1;
        });
        console.log("Version Counts:", counts);
        console.log("Latest Versions:", verDist.slice(0, 5));
    }

    // 7. Validar versiones activas múltiples
    console.log("\n[7] Multiple Active Versions Check:");
    const { data: actives, error: err7 } = await client
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version, estado')
        .eq('estado', 'activo')
        .eq('hotel', 'Sercotel Guadiana')
        .in('semana_inicio', ['2026-05-18', '2026-06-01']);
    
    if (err7) console.error(err7);
    else {
        const groups = {};
        actives.forEach(a => {
            const k = `${a.hotel}|${a.semana_inicio}`;
            if (!groups[k]) groups[k] = [];
            groups[k].push(a.version);
        });
        Object.entries(groups).forEach(([k, vers]) => {
            console.log(`${k} has ${vers.length} active versions: ${vers.join(', ')}`);
        });
    }

    console.log("\n--- FINAL AUDIT END ---");
}

runAudit();
