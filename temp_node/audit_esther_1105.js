const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

async function audit() {
    const { data } = await client
        .from('publicaciones_cuadrante')
        .select('version,snapshot_json')
        .eq('hotel','Cumbria Spa&Hotel')
        .eq('semana_inicio','2026-05-11')
        .order('version', {ascending:true});

    console.log('| Versión | PuestoOrden | Esther 11/05 Code | Type | Válida? |');
    console.log('|---|---|---|---|---|');

    data.forEach(s => {
        const snap = s.snapshot_json;
        const emps = snap.empleados || snap.rows || [];
        const esther = emps.find(e => (e.nombre || '').includes('Esther'));
        if (!esther) return;

        const cells = esther.dias || esther.cells || {};
        const c = cells['2026-05-11'] || {};
        const po = esther.puestoOrden || esther.orden;
        
        const hasValidPO = po < 900;
        const hasValidSemantics = (c.type === 'VAC' || c.type === 'BAJA' ? (c.code && c.code !== '—') : true);
        const isValid = hasValidPO && hasValidSemantics;

        console.log(`| v${s.version} | ${po} | ${c.code || '—'} | ${c.type || 'NORMAL'} | ${isValid ? 'SÍ' : 'NO'} |`);
    });
}

audit();
