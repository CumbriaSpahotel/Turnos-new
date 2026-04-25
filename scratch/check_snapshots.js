const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSnapshots() {
    console.log("--- COMPROBAR TABLA ---");
    const { data: rows, error: errorRows } = await supabase
        .from('publicaciones_cuadrante')
        .select('id, semana_inicio, semana_fin, hotel, estado, version, fecha_publicacion')
        .order('fecha_publicacion', { ascending: false })
        .limit(20);
    
    if (errorRows) {
        console.error("Error fetching snapshots:", errorRows.code, errorRows.message);
    } else {
        console.log("Filas encontradas:", rows.length);
        console.table(rows);
    }

    console.log("\n--- COMPROBAR SEMANA EXACTA (2026-04-20) ---");
    const { data: weekRows, error: errorWeek } = await supabase
        .from('publicaciones_cuadrante')
        .select('id, semana_inicio, semana_fin, hotel, estado, version, fecha_publicacion')
        .eq('semana_inicio', '2026-04-20')
        .eq('semana_fin', '2026-04-26')
        .order('hotel', { ascending: true })
        .order('version', { ascending: false });

    if (errorWeek) {
        console.error("Error fetching specific week:", errorWeek.code, errorWeek.message);
    } else {
        console.log("Filas para la semana:", weekRows.length);
        console.table(weekRows);
    }

    console.log("\n--- VALIDAR EMPLEADOS EN SNAPSHOT_JSON ---");
    const { data: snapData, error: errorSnap } = await supabase
        .from('publicaciones_cuadrante')
        .select('hotel, snapshot_json')
        .eq('semana_inicio', '2026-04-20')
        .eq('semana_fin', '2026-04-26')
        .eq('estado', 'activo');

    if (errorSnap) {
        console.error("Error fetching snapshot data:", errorSnap.code, errorSnap.message);
    } else {
        snapData.forEach(s => {
            const emps = s.snapshot_json?.empleados || [];
            console.log(`Hotel: ${s.hotel}, Empleados: ${emps.length}`);
        });
    }
}

checkSnapshots();
