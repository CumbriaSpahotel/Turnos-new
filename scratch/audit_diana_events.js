const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: employees } = await supabase.from('empleados').select('*');
    const diana = employees.find(e => e.nombre.includes('Diana'));
    console.log('Diana:', diana ? { id: diana.id, nombre: diana.nombre } : 'Not found');

    const { data: events } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .or(`empleado_id.eq.${diana.id},empleado_destino_id.eq.${diana.id}`)
        .order('fecha_inicio', { ascending: true });

    console.log(`\nEvents for Diana (${events.length}):`);
    events.forEach(ev => {
        const start = ev.fecha_inicio;
        if (start.startsWith('2026-06')) {
            console.log('--- EVENT ---');
            console.log(JSON.stringify(ev, null, 2));
        }
    });
}

run().catch(console.error);
