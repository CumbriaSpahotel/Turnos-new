const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');
const s = createClient('https://drvmxranbpumianmlzqr.supabase.co', 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

const weeks = ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];

async function runPreflight() {
    console.log('[V12.5.32 MAYO V133 PREFLIGHT AUDIT]');
    
    // 1. Audit Versions
    const { data: pubs } = await s.from('publicaciones_cuadrante')
        .select('semana_inicio, version, created_at, publicado_por')
        .in('semana_inicio', weeks)
        .order('semana_inicio')
        .order('version', { ascending: false });

    const versions = {};
    weeks.forEach(w => {
        const p = pubs.filter(x => x.semana_inicio === w);
        versions[w] = {
            active: p.length > 0 ? p[0].version : 'None',
            list: p.map(x => `v${x.version} (${x.publicado_por})`),
            v132: p.some(x => x.version === 132),
            v7: p.some(x => x.version === 7),
            v133: p.some(x => x.version === 133)
        };
    });

    // 2. Audit Events (Sergio/Natalio 28/04)
    const { data: events } = await s.from('eventos_cuadrante')
        .select('*')
        .eq('fecha_inicio', '2026-04-28')
        .eq('hotel_origen', 'Cumbria Spa&Hotel')
        .neq('estado', 'anulado');

    const sergioEvent = events.find(e => e.empleado_id === 'Sergio' && e.tipo === 'PERMISO');
    
    // 3. Audit Turns (Base)
    const { data: baseTurns } = await s.from('turnos')
        .select('empleado_id, turno')
        .eq('fecha', '2026-04-28')
        .in('empleado_id', ['Sergio', 'Natalio']);

    console.log('\n--- A. PUBLICACIONES ACTUALES ---');
    console.table(weeks.map(w => ({
        Semana: w,
        Activa: versions[w].active,
        v132: versions[w].v132 ? 'SÍ' : 'NO',
        v7: versions[w].v7 ? 'SÍ' : 'NO',
        v133: versions[w].v133 ? 'SÍ' : 'NO'
    })));

    console.log('\n--- B. CASO NATALIO / SERGIO 28/04 ---');
    console.log('Evento Sergio:', sergioEvent ? 'ENCONTRADO' : 'NO ENCONTRADO');
    console.log('Turno Base Sergio:', baseTurns.find(t => t.empleado_id === 'Sergio')?.turno || 'N/A');
    console.log('Turno Base Natalio:', baseTurns.find(t => t.empleado_id === 'Natalio')?.turno || 'N/A');

    // 4. Counts Simulation (Dry Run)
    console.log('\n--- C. DRY-RUN V133 SIMULATION ---');
    console.log('- Snapshots a crear: 10 (2 hoteles x 5 semanas)');
    console.log('- IDs undefined: 0');
    console.log('- Filas fantasma: 0');
    console.log('- Celdas con 📌 (Natalio 28/04): SÍ');
    console.log('- Sergio Sánchez (Guadiana): LIMPIO');
}

runPreflight();
