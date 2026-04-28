/**
 * DIAGNÓSTICO ORDEN – Cumbria 04/05/2026
 * Compara: Excel map vs snapshot v3 vs lo que ve index.html
 */
'use strict';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

const HOTEL   = 'Cumbria Spa&Hotel';
const W_START = '2026-05-04';

function nid(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' '); }

async function run(){
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  DIAGNÓSTICO ORDEN – Cumbria 04/05/2026');
  console.log('════════════════════════════════════════════════════════════\n');

  // ── A) ORDEN EXCEL MAP ────────────────────────────────────────────────────
  const mapRaw = JSON.parse(fs.readFileSync('../data/v9_excel_order_map.json','utf8'));
  const mapArr = Array.isArray(mapRaw) ? mapRaw : Object.values(mapRaw);

  // Semanas disponibles para Cumbria
  const cumbriaEntries = mapArr.filter(e => e.hotel === HOTEL);
  const weeks = [...new Set(cumbriaEntries.map(e=>e.week_start))].sort();
  console.log('Semanas disponibles en mapa para Cumbria:');
  weeks.forEach(w=>console.log('  '+w));

  // Buscar la semana exacta, si no existe buscar la más cercana anterior
  const exactWeek = cumbriaEntries.filter(e=>e.week_start===W_START);
  let mapEntries = exactWeek;
  if (!mapEntries.length) {
    // Semana más cercana anterior
    const prev = weeks.filter(w=>w<=W_START).pop();
    mapEntries = cumbriaEntries.filter(e=>e.week_start===prev);
    console.log(`\nNo hay mapa exacto para ${W_START}. Usando semana más próxima: ${prev}`);
  } else {
    console.log(`\nMapa exacto encontrado para ${W_START}`);
  }
  mapEntries.sort((a,b)=>a.order-b.order);

  console.log('\nA) Orden Excel/mapa:');
  mapEntries.forEach(e=>console.log(`  orden=${e.order} excel_row=${e.excel_row_index} empleado="${e.empleado_nombre||e.empleado_id}"`));

  // ── B) ORDEN SNAPSHOT v3 ──────────────────────────────────────────────────
  const{data:snaps}=await client.from('publicaciones_cuadrante').select('id,version,snapshot_json')
    .eq('hotel',HOTEL).eq('estado','activo')
    .gte('semana_fin',W_START).lte('semana_inicio',W_START)
    .order('version',{ascending:false}).limit(1);
  const snap=snaps?.[0];
  if(!snap){ console.log('\nNO HAY SNAPSHOT ACTIVO para '+W_START); return; }
  const emps = snap.snapshot_json?.empleados || snap.snapshot_json?.rows || [];
  console.log(`\nB) Snapshot v${snap.version} (${snap.id}) — ${emps.length} filas:`);
  console.log('   Raw order (como llegan en array):');
  emps.forEach((e,i)=>console.log(`  [${i}] orden=${e.orden} nombre="${e.nombre||e.nombreVisible||e.empleado_id}"`));
  console.log('   Sorted by orden asc (como renderiza index.html):');
  const snapSorted=[...emps].sort((a,b)=>(a.orden||999)-(b.orden||999));
  snapSorted.forEach((e,i)=>console.log(`  ${i+1}. orden=${e.orden} nombre="${e.nombre||e.nombreVisible||e.empleado_id}"`));

  // ── C) COMPARACIÓN ────────────────────────────────────────────────────────
  console.log('\nC) Comparación Excel vs Snapshot (por nombre normalizado):');
  const snapNames = snapSorted.map(e=>nid(e.nombre||e.nombreVisible||e.empleado_id));
  const mapNames  = mapEntries.map(e=>nid(e.empleado_nombre||e.empleado_id));

  let hasDiff = false;
  const maxLen = Math.max(snapNames.length, mapNames.length);
  for(let i=0;i<maxLen;i++){
    const sn=snapNames[i]||'—';
    const mn=mapNames[i]||'—';
    const ok=sn===mn;
    if(!ok) hasDiff=true;
    console.log(`  pos${i+1}: snapshot="${sn}" | mapa="${mn}" ${ok?'✅':'❌ DIFERENTE'}`);
  }

  // ── D) Empleados en mapa pero no en snapshot (y viceversa) ────────────────
  const snapSet=new Set(snapNames), mapSet=new Set(mapNames);
  const soloSnap=[...snapSet].filter(n=>!mapSet.has(n));
  const soloMapa=[...mapSet].filter(n=>!snapSet.has(n));
  if(soloSnap.length) console.log('\nEn snapshot pero NO en mapa: '+soloSnap.join(', '));
  if(soloMapa.length) console.log('En mapa pero NO en snapshot: '+soloMapa.join(', '));

  // ── E) DIAGNÓSTICO ────────────────────────────────────────────────────────
  console.log('\nD) Diagnóstico:');
  if(!hasDiff){
    console.log('  ✅ Orden snapshot v3 = Orden mapa Excel. index.html muestra el orden correcto.');
    console.log('  El orden visual que ves en la vista pública es correcto.');
    console.log('  Si el orden público parece diferente, revisar si index.html hace sort adicional.');
  } else {
    console.log('  ❌ Orden INCORRECTO. El snapshot v3 no respeta el orden del mapa Excel.');
    console.log('  → Hay que regenerar v4 respetando el mapa.');
  }

  // ── F) Verificar sort de index.html ─────────────────────────────────────
  console.log('\nE) Verificación sort de index.html (línea 1159):');
  const idxHtml = fs.readFileSync('../index.html','utf8');
  const sortMatch = idxHtml.match(/table\.setData\([^)]+\)/);
  if(sortMatch) console.log('  Encontrado: '+sortMatch[0]);
  else console.log('  No encontrado setData en index.html');

  console.log('\n════════════════════════════════════════════════════════════\n');
}

run().catch(e=>{console.error('[FATAL]',e.message,e.stack);process.exit(1);});
