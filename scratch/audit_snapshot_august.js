const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://drvmxranbpumianmlzqr.supabase.co';
const supabaseKey = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

const client = createClient(supabaseUrl, supabaseKey);

async function checkSnapshot() {
    const { data: snaps, error } = await client
        .from('publicaciones_cuadrante')
        .select('id, hotel, semana_inicio, snapshot_json')
        .eq('semana_inicio', '2026-08-17')
        .eq('hotel', 'Sercotel Guadiana')
        .eq('estado', 'activo')
        .order('version', { ascending: false })
        .limit(1);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    if (!snaps || snaps.length === 0) {
        console.log('NO SNAPSHOT FOUND FOR 2026-08-17');
        return;
    }
    
    const snap = snaps[0];
    const rows = snap.snapshot_json.rows || snap.snapshot_json.empleados || [];
    const sandra = rows.find(r => (r.nombre || '').includes('Sandra'));
    
    console.log('SNAPSHOT FOUND:', snap.id);
    console.log('TOTAL ROWS:', rows.length);
    console.log('SANDRA IN SNAPSHOT:', sandra ? 'YES' : 'NO');
    if (sandra) {
        console.log('SANDRA DATA:', JSON.stringify(sandra, null, 2));
    } else {
        console.log('ALL NAMES:', rows.map(r => r.nombre || r.nombreVisible).join(', '));
    }
}

checkSnapshot();
