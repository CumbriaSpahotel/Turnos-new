const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking ALL publications (active and inactive) for week 2026-06-01...");
  const { data: pubs, error: errPub } = await supabase
    .from('publicaciones_cuadrante')
    .select('*')
    .eq('semana_inicio', '2026-06-01');
  if (errPub) console.error("Error:", errPub);
  else {
    console.log(`Total publications found: ${pubs.length}`);
    for (const pub of pubs) {
      console.log(`- ID: ${pub.id}, Hotel: ${pub.hotel}, Version: ${pub.version}, Status: ${pub.estado}, Created: ${pub.created_at}`);
      const rows = pub.snapshot_json.rows || pub.snapshot_json.empleados || [];
      const natalioRows = rows.filter(r => r.nombre === 'Natalio' || r.empleado_id === 'Natalio');
      console.log(`  Natalio rows count: ${natalioRows.length}`);
      if (natalioRows.length > 0) {
        console.log(`  Shifts for Natalio:`, JSON.stringify(natalioRows.map(r => r.dias || r.cells), null, 2));
      }
    }
  }

  console.log("\nChecking Turnos table for date 2026-06-01...");
  const { data: turnos, error: errT } = await supabase
    .from('turnos')
    .select('*')
    .eq('fecha', '2026-06-01');
  if (errT) console.error("Error turnos:", errT);
  else {
    console.log("Turnos on 2026-06-01:", turnos);
  }

  console.log("\nChecking Eventos Cuadrante for date 2026-06-01...");
  const { data: events, error: errE } = await supabase
    .from('eventos_cuadrante')
    .select('*')
    .lte('fecha_inicio', '2026-06-01');
  if (errE) console.error("Error events:", errE);
  else {
    const active = events.filter(e => e.estado === 'activo' && (!e.fecha_fin || e.fecha_fin >= '2026-06-01'));
    console.log(`Active events on 2026-06-01: ${active.length}`);
    console.log(active.map(e => ({
      id: e.id,
      tipo: e.tipo,
      empleado_id: e.empleado_id,
      empleado_destino_id: e.empleado_destino_id,
      hotel_origen: e.hotel_origen,
      fecha_inicio: e.fecha_inicio,
      fecha_fin: e.fecha_fin,
      turno_nuevo: e.turno_nuevo,
      observaciones: e.observaciones,
      payload: e.payload
    })));
  }
}

check();
