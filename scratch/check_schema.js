
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const configContent = fs.readFileSync('supabase-config.js', 'utf8');
const url = configContent.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)[1];
const key = configContent.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)[1];
const supabase = createClient(url, key);

async function checkSchema() {
    // We don't have direct access to pg_catalog via REST normally,
    // so let's try to query common tables to see if they exist.
    const tables = ['turnos', 'eventos_cuadrante', 'solicitudes', 'posiciones_operativas', 'publicaciones_cuadrante', 'publicaciones_log', 'empleados'];
    const results = {};
    
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('count').limit(1);
        results[table] = !error;
    }
    
    console.log("Table existence check:");
    console.log(JSON.stringify(results, null, 2));
}

checkSchema();
