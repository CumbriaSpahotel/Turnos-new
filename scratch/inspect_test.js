const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectSnapshots() {
    console.log("--- INSPECCIÓN DE SNAPSHOTS ---");
    const { data: rows } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('semana_inicio', '2026-04-20')
        .order('hotel', { ascending: true })
        .order('version', { ascending: false });

    rows.forEach(r => {
        console.log(`\nID: ${r.id} | Hotel: ${r.hotel} | Ver: ${r.version} | Estado: ${r.estado}`);
        const snap = r.snapshot_json;
        console.log(`- Empleados: ${snap.empleados?.length || 0}`);
        
        if (r.hotel === 'Cumbria Spa&Hotel' && r.estado === 'activo') {
            console.log("- Detalle Cumbria (Activo):");
            snap.empleados.forEach(e => {
                const turns = Object.values(e.dias).map(d => d.code).join(', ');
                console.log(`  * ${e.nombre} [${e.puesto}]: ${turns}`);
            });
        }
    });

    // Validar Logs
    console.log("\n--- ÚLTIMOS LOGS ---");
    const { data: logs } = await supabase
        .from('publicaciones_log')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(5);
    console.table(logs.map(l => ({ 
        fecha: l.fecha, 
        usuario: l.usuario, 
        accion: l.resumen_json?.accion,
        hotel: l.resumen_json?.hotel 
    })));
}

inspectSnapshots();
