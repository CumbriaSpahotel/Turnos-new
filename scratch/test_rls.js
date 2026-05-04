const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
    console.log("Testing INSERT into publicaciones_cuadrante...");
    const payload = {
        semana_inicio: '2026-12-28',
        semana_fin: '2027-01-03',
        hotel: 'TEST_HOTEL',
        estado: 'activo',
        version: 9999,
        publicado_por: 'TEST_RUNNER',
        resumen: { test: true },
        snapshot_json: { test: true, rows: [] }
    };

    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .insert([payload])
        .select();

    if (error) {
        console.error("Insert Error:", error);
        return;
    }

    console.log("Insert Success:", data[0].id);

    console.log("Testing UPDATE...");
    const { error: updateError } = await client
        .from('publicaciones_cuadrante')
        .update({ estado: 'reemplazado' })
        .eq('id', data[0].id);

    if (updateError) {
        console.error("Update Error:", updateError);
    } else {
        console.log("Update Success!");
    }

    // Cleanup
    await client.from('publicaciones_cuadrante').delete().eq('id', data[0].id);
}

testInsert();
