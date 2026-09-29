const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const content = fs.readFileSync('supabase-config.js', 'utf8');
const urlMatch = content.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = content.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  console.log('1. Actualizando turno de Dani el domingo 27/09/2026 a M/N...');
  const { data: updateTurno, error: errTurno } = await supabase
    .from('turnos')
    .update({ turno: 'M/N', updated_at: new Date().toISOString(), updated_by: 'MANUAL_FIX_DANI_MN' })
    .match({ empleado_id: 'Dani', fecha: '2026-09-27' })
    .select();
  console.log('Turno Dani actualizado:', updateTurno, errTurno);

  console.log('2. Anulando evento duplicado OTRO (eb7030d0-a616-4413-8a35-f9bf02ca24ef)...');
  const { data: anulaEvt, error: errAnula } = await supabase
    .from('eventos_cuadrante')
    .update({ estado: 'anulado', updated_at: new Date().toISOString(), updated_by: 'WEB_ADMIN' })
    .eq('id', 'eb7030d0-a616-4413-8a35-f9bf02ca24ef')
    .select();
  console.log('Evento anulado:', anulaEvt, errAnula);

  console.log('3. Actualizando evento BAJA 3b536775-c532-4b78-a6d4-19f198d4922b con doble_turno: true...');
  const { data: evtBaja } = await supabase
    .from('eventos_cuadrante')
    .select('*')
    .eq('id', '3b536775-c532-4b78-a6d4-19f198d4922b')
    .single();

  if (evtBaja) {
    const payload = { ...evtBaja.payload, doble_turno: true };
    const { data: updBaja, error: errBaja } = await supabase
      .from('eventos_cuadrante')
      .update({ payload, updated_at: new Date().toISOString(), updated_by: 'WEB_ADMIN' })
      .eq('id', evtBaja.id)
      .select();
    console.log('Evento BAJA actualizado con doble_turno:', updBaja, errBaja);
  }

  console.log('4. Actualizando snapshot de publicación semana 2026-09-21 Guadiana...');
  const { data: pub, error: errPub } = await supabase
    .from('publicaciones_cuadrante')
    .select('*')
    .eq('id', '9c64eec8-54be-4a73-af48-b3a45c870f5f')
    .single();

  if (pub) {
    const snap = pub.snapshot_json;
    const rows = snap.filas || snap.empleados || snap.rows || [];
    const dani = rows.find(r => (r.nombre || '').toLowerCase().includes('dani') || r.empleado_id === 'Dani');
    if (dani) {
      const cellDoble = {
        code: 'M/N',
        type: 'NORMAL',
        icons: ['☀️', '🌙', '📌'],
        label: 'Mañana + Noche',
        title: 'Mañana (base) + Noche (cobertura baja Federico)',
        origen: 'BAJA',
        changed: true,
        horario: '07:00 - 15:00 / 23:00 - 07:00',
        isAbsence: false,
        sustituto: null,
        isRefuerzo: false,
        titular_cubierto: 'Federico',
        incidenciaCubierta: 'BAJA'
      };

      if (dani.dias) dani.dias['2026-09-27'] = cellDoble;
      if (dani.cells) dani.cells['2026-09-27'] = cellDoble;
      console.log('Dani actualizado en snapshot:', JSON.stringify(dani.dias?.['2026-09-27'], null, 2));

      const { data: updSnap, error: errSnap } = await supabase
        .from('publicaciones_cuadrante')
        .update({
          snapshot_json: snap,
          version: pub.version + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', pub.id)
        .select();
      console.log('Snapshot semana 2026-09-21 actualizado a v' + (pub.version + 1), errSnap);
    }
  }
}

run().catch(console.error);
