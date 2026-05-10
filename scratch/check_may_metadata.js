const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co', 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

async function checkMaySnapshot() {
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
  
  // Find a row that should have a pin (substitution)
  // In the conversation history, "Dani" and "Diana" were mentioned for May.
  const dani = rows.find(r => String(r.nombreVisible || r.nombre).includes('Dani'));
  if (dani) {
    console.log(`Dani row:`, JSON.stringify(dani).substring(0, 500));
    const cells = dani.turnosOperativos || dani.dias || dani.cells || {};
    Object.keys(cells).forEach(date => {
        const cell = cells[date];
        if (cell.titular_cubierto || cell.sustituto || cell.origen?.includes('SUSTITUCION')) {
            console.log(`Cell for ${date}:`, JSON.stringify(cell));
        }
    });
  }
}

checkMaySnapshot();
