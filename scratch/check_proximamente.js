const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co', 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

async function checkProximamente() {
  const { data, error } = await client
    .from('publicaciones_cuadrante')
    .select('*')
    .eq('semana_inicio', '2026-05-11')
    .eq('hotel', 'Sercotel Guadiana')
    .order('version', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('Error or no data:', error);
    return;
  }

  const snap = data[0];
  const rows = snap.snapshot_json?.rows || snap.snapshot_json?.empleados || [];
  
  const proximamente = rows.find(r => String(r.nombreVisible || r.nombre).toLowerCase().includes('proximamente'));
  if (proximamente) {
    console.log(`Próximamente row:`, JSON.stringify(proximamente).substring(0, 500));
    const cells = proximamente.turnosOperativos || proximamente.dias || proximamente.cells || {};
    console.log(`Cells:`, JSON.stringify(cells));
  } else {
    console.log('Próximamente not found in rows.');
  }
}

checkProximamente();
