/**
 * DIAGNÓSTICO – Sergio – Cumbria 04/05/2026
 * ==========================================
 * Solo lectura. No escribe nada.
 */
'use strict';
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

const HOTEL    = 'Cumbria Spa&Hotel';
const W_START  = '2026-05-04';
const W_END    = '2026-05-10';
const EMP_NAME = 'sergio';

function nid(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(); }

async function run() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  DIAGNÓSTICO – Sergio – Cumbria Spa&Hotel – 04/05/2026');
  console.log('════════════════════════════════════════════════════════════\n');

  // ── A: TODAS LAS VERSIONES GUARDADAS ────────────────────────────────────
  console.log('── A) Snapshots guardados para Cumbria 04/05/2026 ──────────');
  const { data: allSnaps, error: e1 } = await client
    .from('publicaciones_cuadrante').select('id,semana_inicio,semana_fin,hotel,version,estado,fecha_publicacion,publicado_por')
    .eq('hotel', HOTEL).gte('semana_fin', W_START).lte('semana_inicio', W_END)
    .order('version', { ascending: false });
  if (e1) { console.error('Error:', e1.message); process.exit(1); }
  if (!allSnaps?.length) { console.log('  ⚠️  NO HAY snapshots para Cumbria 04/05/2026'); }
  else {
    allSnaps.forEach(s => {
      console.log(`  [v${s.version}] id=${s.id} | estado=${s.estado} | publicado_por=${s.publicado_por} | fecha=${s.fecha_publicacion?.slice(0,19)}`);
    });
  }

  // ── B: SNAPSHOT ACTIVO – row Sergio ─────────────────────────────────────
  console.log('\n── B) Snapshot ACTIVO – row Sergio ─────────────────────────');
  const { data: activos } = await client
    .from('publicaciones_cuadrante').select('id,version,estado,fecha_publicacion,snapshot_json')
    .eq('hotel', HOTEL).eq('estado', 'activo')
    .gte('semana_fin', W_START).lte('semana_inicio', W_END)
    .order('version', { ascending: false }).limit(1);

  const snap = activos?.[0];
  if (!snap) {
    console.log('  ❌ NO hay snapshot ACTIVO para Cumbria 04/05/2026');
    console.log('  → La vista pública no puede mostrar nada para esta semana.');
    console.log('  → CAUSA: Nunca se publicó esta semana, o se marcó como reemplazado.');
  } else {
    console.log(`  Snapshot ID : ${snap.id}`);
    console.log(`  Versión     : v${snap.version}`);
    console.log(`  Estado      : ${snap.estado}`);
    console.log(`  Publicado   : ${snap.fecha_publicacion?.slice(0,19)}`);

    const emps = snap.snapshot_json?.empleados || snap.snapshot_json?.rows || [];
    console.log(`  Empleados en snapshot: ${emps.length}`);
    console.log('  Lista: ' + emps.map(e=>e.nombre||e.nombreVisible||e.empleado_id).join(', '));

    const sergioRow = emps.find(e =>
      nid(e.nombre||e.nombreVisible||e.empleado_id).includes(EMP_NAME)
    );

    if (!sergioRow) {
      console.log(`\n  ❌ SERGIO NO APARECE EN EL SNAPSHOT ACTIVO.`);
      console.log('  → Causa probable: el snapshot se generó antes del fix B4 o Sergio no tenía turno base.');
    } else {
      console.log(`\n  ✅ Sergio encontrado: "${sergioRow.nombre||sergioRow.nombreVisible}"`);
      const dias = sergioRow.dias || sergioRow.cells || {};
      console.log('  Cells de Sergio (04/05 → 10/05):');
      ['2026-05-04','2026-05-05','2026-05-06','2026-05-07','2026-05-08','2026-05-09','2026-05-10'].forEach(d => {
        const c = dias[d];
        if (!c) {
          console.log(`    ${d}: ❌ CELDA AUSENTE`);
        } else {
          const ok = c.code==='VAC'||c.type==='VAC';
          console.log(`    ${d}: code="${c.code}" type="${c.type}" label="${c.label}" ${ok?'✅ VAC':'❌ NO-VAC'}`);
        }
      });
    }
  }

  // ── C: SIMULACIÓN DE loadPublishedSchedule (como lo llama index.html) ───
  console.log('\n── C) Simulación de loadPublishedSchedule (como index.html) ─');
  const { data: indexQuery } = await client
    .from('publicaciones_cuadrante').select('*')
    .eq('estado', 'activo')
    .gte('semana_fin', W_START).lte('semana_inicio', W_END)
    .order('semana_inicio', { ascending: true }).order('hotel', { ascending: true });

  if (!indexQuery?.length) {
    console.log('  ❌ index.html no recibe ningún snapshot para esta semana.');
  } else {
    // Replicar deduplicación de loadPublishedSchedule
    const sorted = [...indexQuery].sort((a,b)=>{
      if (b.version!==a.version) return b.version-a.version;
      return new Date(b.fecha_publicacion)-new Date(a.fecha_publicacion);
    });
    const seenHotels = new Set(), deduped=[];
    for (const d of sorted) {
      const hN = String(d.hotel||'').toUpperCase();
      if (hN.includes('TEST')||hN.includes('MOCK')) continue;
      if (!seenHotels.has(d.hotel)) {
        deduped.push(d);
        seenHotels.add(d.hotel);
      }
    }

    console.log(`  index.html recibe ${deduped.length} snapshot(s) tras deduplicación:`);
    for (const d of deduped) {
      console.log(`    → Hotel="${d.hotel}" semana_inicio=${d.semana_inicio} semana_fin=${d.semana_fin} v${d.version} id=${d.id}`);
      const emps = d.snapshot_json?.empleados||d.snapshot_json?.rows||[];
      const sRow = emps.find(e=>nid(e.nombre||e.nombreVisible||e.empleado_id).includes(EMP_NAME));
      if (!sRow) {
        console.log('    ❌ Sergio NO aparece en el snapshot que lee index.html');
      } else {
        const dias=sRow.dias||sRow.cells||{};
        const c04=dias['2026-05-04'];
        console.log(`    Sergio 04/05: code="${c04?.code}" type="${c04?.type}" label="${c04?.label}"`);
        const ok=c04?.code==='VAC'||c04?.type==='VAC';
        console.log(`    ${ok?'✅ VAC correcto en index':'❌ VAC AUSENTE — index muestra —'}`);
      }
    }

    // Bug de deduplicación: ¿se mezclan semanas?
    if (sorted.length > deduped.length) {
      console.log(`\n  ⚠️  BUG DETECTADO: loadPublishedSchedule descarta ${sorted.length-deduped.length} snapshot(s)`);
      console.log('  La deduplicación solo guarda 1 snapshot por hotel (mayor versión),');
      console.log('  ignorando que puede haber múltiples semanas en el rango.');
      const descartados = sorted.filter(s=>!deduped.find(d=>d.id===s.id));
      descartados.forEach(s=>console.log(`    Descartado: Hotel="${s.hotel}" semana=${s.semana_inicio} v${s.version}`));
    }
  }

  // ── D: EVENTOS DE SERGIO EN BD ──────────────────────────────────────────
  console.log('\n── D) Eventos de Sergio en eventos_cuadrante (04/05→10/05) ─');
  const { data: evs } = await client.from('eventos_cuadrante').select('*')
    .or(`empleado_id.ilike.%sergio%,empleado_a_id.ilike.%sergio%`)
    .lte('fecha_inicio', W_END).or(`fecha_fin.is.null,fecha_fin.gte.${W_START}`);
  if (!evs?.length) {
    console.log('  ⚠️  No hay eventos para Sergio en esta semana en eventos_cuadrante');
    console.log('  → Si Vista Previa muestra VAC, el evento existe. Revisar campo empleado_id exacto.');
    // Buscar con búsqueda más amplia
    const { data: evs2 } = await client.from('eventos_cuadrante').select('id,tipo,estado,empleado_id,fecha_inicio,fecha_fin,hotel_origen')
      .lte('fecha_inicio', W_END).or(`fecha_fin.is.null,fecha_fin.gte.${W_START}`)
      .in('tipo',['VAC','VACACIONES','BAJA','PERM','PERMISO']).limit(20);
    if (evs2?.length) {
      console.log('  Eventos VAC/BAJA/PERM activos esta semana (todos empleados):');
      evs2.forEach(e=>console.log(`    ${e.tipo} | ${e.empleado_id} | ${e.fecha_inicio}→${e.fecha_fin} | hotel=${e.hotel_origen} | estado=${e.estado}`));
    }
  } else {
    evs.forEach(e=>console.log(`  ${e.tipo} | estado=${e.estado} | ${e.fecha_inicio}→${e.fecha_fin} | hotel=${e.hotel_origen||e.hotel_destino}`));
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  FIN DIAGNÓSTICO');
  console.log('════════════════════════════════════════════════════════════\n');
}

run().catch(e=>{console.error('[FATAL]',e.message); process.exit(1);});
