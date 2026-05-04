const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function testInsert() {
    if (!SUPABASE_KEY) {
        console.error('ERROR: SUPABASE_KEY no encontrada.');
        return;
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- TEST INSERT ---');
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .insert({
            hotel: 'TEST_INSERT',
            semana_inicio: '2026-06-08',
            semana_fin: '2026-06-14',
            version: 9999,
            estado: 'inactivo',
            snapshot_json: { test: true }
        })
        .select();

    if (error) {
        console.error('Error al insertar:', error);
    } else {
        console.log('Insert exitoso:', data[0].id);
        // Clean up
        const { error: delErr } = await supabase
            .from('publicaciones_cuadrante')
            .delete()
            .eq('id', data[0].id);
        if (delErr) console.error('Error al borrar test:', delErr);
        else console.log('Borrado exitoso.');
    }
}

testInsert();
