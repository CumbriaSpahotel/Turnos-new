const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Intentar leer config de supabase-config.js o similar
// Como no tengo acceso directo a las variables de entorno, intentaré buscarlas en los archivos del proyecto.
const configPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js';
const configContent = fs.readFileSync(configPath, 'utf8');
const urlMatch = configContent.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = configContent.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
    console.error('No se pudo encontrar la configuración de Supabase');
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkActiveSnapshot() {
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('id, version, semana_inicio, hotel, estado')
        .eq('semana_inicio', '2026-04-27')
        .eq('estado', 'activo');
    
    if (error) {
        console.error('Error al consultar snapshots:', error);
        return;
    }
    
    console.log('ACTIVE_SNAPSHOTS_START');
    console.log(JSON.stringify(data, null, 2));
    console.log('ACTIVE_SNAPSHOTS_END');
}

checkActiveSnapshot();
