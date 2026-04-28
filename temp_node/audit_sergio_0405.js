const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

async function audit() {
    const { data } = await client
        .from('publicaciones_cuadrante')
        .select('version,snapshot_json')
        .eq('hotel','Cumbria Spa&Hotel')
        .eq('semana_inicio','2026-05-04')
        .order('version', {ascending:true});

    console.log('| Versión | PuestoOrden | Sergio 04/05 Code | Type | Válida? |');
    console.log('|---|---|---|---|---|');

    data.forEach(s => {
        const snap = s.snapshot_json;
        const emps = snap.empleados || snap.rows || [];
        const sergio = emps.find(e => (e.nombre || '').includes('Sergio'));
        if (!sergio) return;

        const cells = sergio.dias || sergio.cells || {};
        const c = cells['2026-05-04'] || {};
        const po = sergio.puestoOrden || sergio.orden;
        
        const hasValidPO = po < 900;
        const hasValidSemantics = (c.type === 'VAC' ? (c.code && c.code !== '—') : true);
        const isValid = hasValidPO && hasValidSemantics;

        console.log(`| v${s.version} | ${po} | ${c.code || '—'} | ${c.type || 'NORMAL'} | ${isValid ? 'SÍ' : 'NO'} |`);
    });
}

audit();
