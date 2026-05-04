const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

// Configuración de Supabase (Extraída de la información del proyecto)
const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Asumiendo que está disponible en el entorno o la buscaremos

async function precheck() {
    if (!SUPABASE_KEY) {
        console.error('ERROR: SUPABASE_KEY no encontrada.');
        return;
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const idsV141 = ['e2fea989-c4b2-46bd-8175-b6d6a78fc611', '211acb66-96f9-460c-987f-d4eb36ba0b9a'];
    const idsV140 = ['0f033d9f-f594-4511-869c-1ccce2bc763d', '54f1dfbd-28a5-42a5-9153-8f79d4637fc5'];

    console.log('--- PRECHECK V141 ---');
    const { data: v141, error: err141 } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .in('id', idsV141);

    if (err141) console.error('Error V141:', err141);
    else {
        v141.forEach(s => {
            console.log(`ID: ${s.id}, Hotel: ${s.hotel}, Semana: ${s.semana_inicio}, Version: ${s.version}, Estado: ${s.estado}, Publicado por: ${s.publicado_por}`);
            const firstRow = (s.snapshot_json.rows || s.snapshot_json.empleados || [])[0];
            if (firstRow) {
                const keys = Object.keys(firstRow.cells || firstRow.dias || {});
                console.log(`- Primeras 5 claves de cells: ${keys.slice(0, 5).join(', ')}`);
            }
        });
    }

    console.log('\n--- PRECHECK V140 ---');
    const { data: v140, error: err140 } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .in('id', idsV140);

    if (err140) console.error('Error V140:', err140);
    else {
        v140.forEach(s => {
            console.log(`ID: ${s.id}, Hotel: ${s.hotel}, Semana: ${s.semana_inicio}, Version: ${s.version}, Estado: ${s.estado}`);
            const rows = s.snapshot_json.rows || s.snapshot_json.empleados || [];
            const firstRow = rows[0];
            if (firstRow) {
                const keys = Object.keys(firstRow.cells || firstRow.dias || {});
                console.log(`- Primeras 5 claves de cells: ${keys.slice(0, 5).join(', ')}`);
                const turnosValidos = rows.some(r => {
                    const cells = r.cells || r.dias || {};
                    return Object.values(cells).some(c => c.code && c.code !== '—' && c.code !== '');
                });
                console.log(`- Contiene turnos reales (no vacíos): ${turnosValidos}`);
            }
        });
    }
}

precheck();
