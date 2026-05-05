const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsertReemplazado() {
    console.log("Testing INSERT with estado='reemplazado'...");
    
    const payload = {
        hotel: 'TEST_RLS',
        semana_inicio: '2026-01-01',
        semana_fin: '2026-01-07',
        version: 9999,
        estado: 'reemplazado', // This might trigger the RLS violation if policy is "estado = 'activo'"
        snapshot_json: { test: true },
        publicado_por: 'TEST_AGENT'
    };

    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .insert([payload])
        .select();

    if (error) {
        console.error("Insert Error:", error);
    } else {
        console.log("Insert Success! ID:", data[0].id);
        // Clean up
        await client.from('publicaciones_cuadrante').delete().eq('id', data[0].id);
    }
}

testInsertReemplazado();
