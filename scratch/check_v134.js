
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Intentar leer config de archivos locales
let supabaseUrl, supabaseKey;
try {
    const configText = fs.readFileSync('supabase-config.js', 'utf8');
    supabaseUrl = configText.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)[1];
    supabaseKey = configText.match(/SUPABASE_KEY\s*=\s*['"]([^'"]+)['"]/)[1];
} catch (e) {
    console.error("Error leyendo config:", e);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkV134() {
    console.log("Consultando V134...");
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('version', 134)
        .eq('hotel', 'Cumbria Spa&Hotel')
        .eq('semana_inicio', '2026-05-11');

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No se encontró la versión 134 para esa semana y hotel.");
        return;
    }

    const snap = data[0];
    const employees = snap.snapshot_json.empleados || snap.snapshot_json.rows || [];
    
    // Buscar a Miriam
    const miriam = employees.find(e => {
        const name = (e.nombre || e.nombreVisible || '').toLowerCase();
        return name.includes('miriam');
    });

    if (!miriam) {
        console.log("Miriam no encontrada en el snapshot.");
    } else {
        console.log("--- Datos de Miriam en V134 ---");
        console.log("ID:", miriam.empleado_id);
        console.log("Días:");
        Object.entries(miriam.dias || {}).forEach(([date, cell]) => {
            console.log(`${date}:`, JSON.stringify(cell));
        });
    }

    // Buscar una cobertura real para comparar (ej: Natalio)
    const natalio = employees.find(e => {
        const name = (e.nombre || e.nombreVisible || '').toLowerCase();
        return name.includes('natalio');
    });

    if (natalio) {
        console.log("\n--- Datos de Natalio en V134 ---");
        Object.entries(natalio.dias || {}).forEach(([date, cell]) => {
            if (cell.icons && (cell.icons.includes('📌') || cell.icons.includes('\u1F4CC'))) {
                console.log(`${date}:`, JSON.stringify(cell));
            }
        });
    }
}

checkV134();
