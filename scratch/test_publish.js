const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testPublish() {
    console.log("--- PROBANDO PUBLICACIÓN (TEST) ---");
    const testSnapshot = {
        semana_inicio: '2026-04-20',
        semana_fin: '2026-04-26',
        hotel: 'TEST HOTEL',
        empleados: [
            { nombre: 'Test Emp', dias: {} }
        ]
    };

    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .insert([{
            semana_inicio: '2026-04-20',
            semana_fin: '2026-04-26',
            hotel: 'TEST HOTEL',
            snapshot_json: testSnapshot,
            resumen: { emps: 1 },
            publicado_por: 'IA_TEST',
            version: 1,
            estado: 'activo'
        }])
        .select();

    if (error) {
        console.error("Error en INSERT:", error.code, error.message);
    } else {
        console.log("Inserción exitosa:", data[0].id);
        
        // Limpiar test
        const { error: delError } = await supabase
            .from('publicaciones_cuadrante')
            .delete()
            .eq('id', data[0].id);
        
        if (delError) console.error("Error eliminando test:", delError.message);
        else console.log("Test eliminado correctamente.");
    }
}

testPublish();
