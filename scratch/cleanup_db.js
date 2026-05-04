const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runCleanup() {
    console.log("--- CLEANUP START ---");

    // 1. PRECHECK
    console.log("\n[1] Multi-Active Combinations (Precheck):");
    const { data: precheck, error: err1 } = await client
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version, id')
        .eq('estado', 'activo');
    
    if (err1) { console.error(err1); return; }

    const groups = {};
    precheck.forEach(r => {
        const k = `${r.hotel}|${r.semana_inicio}`;
        if (!groups[k]) groups[k] = [];
        groups[k].push({ id: r.id, version: r.version });
    });

    const multiActive = Object.entries(groups).filter(([k, v]) => v.length > 1);
    console.log(`Found ${multiActive.length} combinations with multiple active versions.`);
    multiActive.forEach(([k, v]) => {
        console.log(` - ${k}: ${v.length} active versions (${v.map(x => x.version).sort((a,b) => b-a).join(', ')})`);
    });

    // 2. LIMPIEZA SEGURA Sercotel Guadiana 2026-05-18
    console.log("\n[2] Cleaning Sercotel Guadiana 2026-05-18...");
    const targetId = '4ca59644-ff24-4ae8-86f6-cbb2a97cdf27';
    const { data: clean0518, error: err2 } = await client
        .from('publicaciones_cuadrante')
        .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
        .eq('hotel', 'Sercotel Guadiana')
        .eq('semana_inicio', '2026-05-18')
        .eq('estado', 'activo')
        .neq('id', targetId)
        .select();
    
    if (err2) console.error(err2);
    else console.log(`Marked ${clean0518.length} records as 'inactivo' for 2026-05-18.`);

    // 3. LIMPIEZA GENERAL (Sercotel Guadiana 2026-06-01 and others)
    console.log("\n[3] Cleaning other multi-active weeks...");
    let totalCleaned = 0;
    for (const [key, versions] of multiActive) {
        if (key === 'Sercotel Guadiana|2026-05-18') continue; // Already cleaned

        const [hotel, week] = key.split('|');
        // Find highest version
        const sorted = versions.sort((a,b) => b.version - a.version);
        const bestId = sorted[0].id;
        const bestVer = sorted[0].version;

        console.log(` Cleaning ${key}: keeping v${bestVer} (ID ${bestId.slice(0,8)})`);

        const { data: cleanRow, error: errRow } = await client
            .from('publicaciones_cuadrante')
            .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
            .eq('hotel', hotel)
            .eq('semana_inicio', week)
            .eq('estado', 'activo')
            .neq('id', bestId)
            .select();
        
        if (errRow) console.error(`Error cleaning ${key}:`, errRow);
        else {
            totalCleaned += cleanRow.length;
            console.log(`  Marked ${cleanRow.length} records as 'inactivo' for ${key}.`);
        }
    }

    // 4. VERIFICACIÓN POST-LIMPIEZA
    console.log("\n[4] Final Verification:");
    const { data: postcheck, error: err4 } = await client
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version, id')
        .eq('estado', 'activo');
    
    const postGroups = {};
    postcheck.forEach(r => {
        const k = `${r.hotel}|${r.semana_inicio}`;
        if (!postGroups[k]) postGroups[k] = [];
        postGroups[k].push(r.version);
    });

    const stillMulti = Object.entries(postGroups).filter(([k, v]) => v.length > 1);
    if (stillMulti.length === 0) console.log("Success! No more multi-active versions found.");
    else console.log(`WARNING: ${stillMulti.length} combinations still have multi-active versions.`);

    console.log("\n--- CLEANUP END ---");
}

runCleanup();
