const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUpdateReal() {
    console.log("Testing REAL UPDATE into publicaciones_cuadrante...");
    
    // First insert a row
    const payload = {
        semana_inicio: '2026-05-18',
        semana_fin: '2026-05-24',
        hotel: 'Sercotel Guadiana',
        estado: 'activo',
        version: 9999,
        publicado_por: 'TEST_RUNNER',
        resumen: { test: true },
        snapshot_json: { test: true, rows: [] }
    };

    const { data: insertData, error: insertError } = await client
        .from('publicaciones_cuadrante')
        .insert([payload])
        .select();

    if (insertError) {
        console.error("Insert Error:", insertError);
        return;
    }

    const newId = insertData[0].id;
    console.log("Insert Success:", newId);

    // Try to update it
    const { data: updateData, error: updateError } = await client
        .from('publicaciones_cuadrante')
        .update({ estado: 'reemplazado' })
        .eq('id', newId)
        .select();

    if (updateError) {
        console.error("Update Error:", updateError);
    } else {
        console.log("Update Success:", updateData);
    }

    // Cleanup
    await client.from('publicaciones_cuadrante').delete().eq('id', newId);
}

testUpdateReal();
