
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Supabase config
const configPath = path.join(__dirname, '..', 'supabase-config.js');
const configContent = fs.readFileSync(configPath, 'utf8');
const supabaseUrl = configContent.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/)[1];
const supabaseKey = configContent.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function listJuneSnapshots() {
    console.log("--- Snapshots para Junio 2026 (Sercotel Guadiana) ---");
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('id, semana_inicio, semana_fin, hotel, version, created_at')
        .eq('hotel', 'Sercotel Guadiana')
        .gte('semana_inicio', '2026-06-01')
        .lte('semana_inicio', '2026-06-30')
        .order('semana_inicio', { ascending: true });

    if (error) {
        console.error("Error fetching snapshots:", error);
        return;
    }

    if (data.length === 0) {
        console.log("No se encontraron snapshots para Junio 2026 en Sercotel Guadiana.");
    } else {
        console.table(data);
    }
}

listJuneSnapshots();
