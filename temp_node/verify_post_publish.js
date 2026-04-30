const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co', 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

async function verify() {
    console.log('Verificando snapshots publicados...');
    const { data, error } = await client.from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, version, snapshot_json')
        .eq('publicado_por', 'AGENT_AI_STABILIZER')
        .order('semana_inicio');

    if (error) {
        console.error('Error verificando:', error);
        return;
    }

    console.log(`Encontrados ${data.length} snapshots creados por el agente.`);
    
    data.forEach(s => {
        const rows = s.snapshot_json?.rows || [];
        const operational = rows.filter(r => r.rowType === 'operativo').length;
        const absent = rows.filter(r => r.rowType === 'ausencia_informativa').length;
        console.log(`[${s.hotel}] ${s.semana_inicio} (v${s.version}) -> Rows: ${rows.length} (Op: ${operational}, Abs: ${absent})`);
    });

    // Validar muestras específicas solicitadas
    const cumbria0401 = data.find(s => s.hotel.includes('Cumbria') && s.semana_inicio === '2026-01-04');
    if (cumbria0401) {
        console.log('\nValidación Cumbria 2026-01-04:');
        const rows = cumbria0401.snapshot_json.rows;
        const miriam = rows.find(r => r.nombre === 'Miriam');
        const sergio = rows.find(r => r.nombre === 'Sergio');
        console.log(`- Miriam: ${miriam ? 'Posición ' + miriam.puestoOrden : 'No encontrada'}`);
        console.log(`- Sergio: ${sergio ? 'Tipo ' + sergio.rowType + ' Posición ' + sergio.puestoOrden : 'No encontrado'}`);
    }

    const sercotel1502 = data.find(s => s.hotel.includes('Sercotel') && s.semana_inicio === '2026-02-15');
    if (sercotel1502) {
        console.log('\nValidación Sercotel 2026-02-15:');
        const rows = sercotel1502.snapshot_json.rows;
        const withIcons = rows.filter(r => Object.values(r.cells).some(c => c.icons && c.icons.includes('🔄')));
        console.log(`- Filas con cambios (🔄): ${withIcons.length}`);
    }
}

verify().catch(console.error);
