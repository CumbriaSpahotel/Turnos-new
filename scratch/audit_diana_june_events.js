const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: events } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .or('empleado_id.ilike.*Diana*,empleado_destino_id.ilike.*Diana*')
        .order('fecha_inicio', { ascending: true });

    console.log(`Found ${events.length} total events for Diana.`);
    events.forEach(ev => {
        const start = ev.fecha_inicio;
        const end = ev.fecha_fin || ev.fecha_inicio || start;
        // Check if it overlaps with June 2026
        if (start <= '2026-06-30' && end >= '2026-06-01') {
            console.log(`[${ev.tipo}] ${start} to ${end} (${ev.estado}) - ID: ${ev.id}`);
        }
    });
}

run().catch(console.error);
