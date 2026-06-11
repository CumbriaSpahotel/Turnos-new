const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    // 1. Fetch employees
    const { data: employees, error: empErr } = await supabase.from('empleados').select('*');
    if (empErr) {
        console.error('Error fetching employees:', empErr);
        return;
    }

    const sandra = employees.find(e => e.nombre.includes('Sandra'));
    const natalio = employees.find(e => e.nombre.includes('Natalio'));

    console.log('Sandra:', sandra ? { id: sandra.id, nombre: sandra.nombre } : 'Not found');
    console.log('Natalio:', natalio ? { id: natalio.id, nombre: natalio.nombre } : 'Not found');

    // 2. Fetch events in June 2026
    const { data: events, error: evErr } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .gte('fecha_inicio', '2026-05-25')
        .lte('fecha_inicio', '2026-07-05');

    if (evErr) {
        console.error('Error fetching events:', evErr);
        return;
    }

    console.log(`\nFound ${events.length} events in June 2026 timeframe:`);
    events.forEach(ev => {
        const hasSandra = JSON.stringify(ev).toLowerCase().includes('sandra') || (sandra && (ev.empleado_id === sandra.id || ev.empleado_destino_id === sandra.id || ev.sustituto_id === sandra.id));
        const hasNatalio = JSON.stringify(ev).toLowerCase().includes('natalio') || (natalio && (ev.empleado_id === natalio.id || ev.empleado_destino_id === natalio.id || ev.sustituto_id === natalio.id));
        if (hasSandra || hasNatalio) {
            console.log('--- EVENT ---');
            console.log(JSON.stringify(ev, null, 2));
        }
    });
}

run().catch(console.error);
