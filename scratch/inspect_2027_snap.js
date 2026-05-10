const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co', 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

async function inspect2027() {
  const { data, error } = await client
    .from('publicaciones_cuadrante')
    .select('*')
    .eq('semana_inicio', '2027-01-04')
    .eq('hotel', 'Sercotel Guadiana')
    .order('version', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No data found for 2027-01-04');
    return;
  }

  const snap = data[0];
  const rows = snap.snapshot_json?.rows || snap.snapshot_json?.empleados || [];
  console.log(`Snapshot V${snap.version} for ${snap.hotel} | ${snap.semana_inicio}`);
  console.log(`Total rows: ${rows.length}`);
  
  rows.forEach((r, idx) => {
    console.log(`Row ${idx}: name="${r.nombre || r.empleado || r.nombreVisible}", id="${r.empleado_id || r.id}", type="${r.tipo || r.rowType}"`);
    const cells = r.turnosOperativos || r.dias || r.cells || {};
    console.log(`  Cells: ${JSON.stringify(cells).substring(0, 100)}...`);
  });
}

inspect2027();
