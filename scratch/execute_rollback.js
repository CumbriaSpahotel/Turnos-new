const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function rollback() {
    if (!SUPABASE_KEY) {
        console.error('ERROR: SUPABASE_KEY no encontrada.');
        return;
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const idsV141 = ['e2fea989-c4b2-46bd-8175-b6d6a78fc611', '211acb66-96f9-460c-987f-d4eb36ba0b9a'];

    console.log('--- EJECUTANDO ROLLBACK SEGURO V141 ---');
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .update({ estado: 'reemplazado', updated_at: new Date().toISOString() })
        .in('id', idsV141)
        .eq('semana_inicio', '2026-06-08')
        .eq('version', 141)
        .select('id, hotel, semana_inicio, version, estado');

    if (error) {
        console.error('Error al actualizar:', error);
    } else {
        console.log('Filas actualizadas con éxito:');
        data.forEach(row => {
            console.log(`- ID: ${row.id}, Hotel: ${row.hotel}, Semana: ${row.semana_inicio}, Version: ${row.version}, Estado: ${row.estado}`);
        });
    }
}

rollback();
