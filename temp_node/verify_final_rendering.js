/**
 * VERIFICACIÓN FINAL – RENDER PÚBLICO (INDEX + MÓVIL)
 * =======================================================================
 * Simula la selección de snapshots y el ordenamiento de filas.
 * Verifica los casos críticos: Sergio en Cumbria 04/05 y Cumbria 27/04.
 */
'use strict';
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

const W1 = '2026-05-04';
const W2 = '2026-04-27';
const HOTEL = 'Cumbria Spa&Hotel';

async function run(){
  console.log('\n--- VERIFICACIÓN DE SELECCIÓN Y ORDEN (V12) ---');
  
  // 1. Verificar Selección por Clave hotel + week_start
  const { data } = await client.from('publicaciones_cuadrante')
    .select('hotel, semana_inicio, version, created_at, snapshot_json')
    .in('semana_inicio', [W1, W2])
    .eq('hotel', HOTEL)
    .order('semana_inicio')
    .order('version', { ascending: false });

  const snapshots = [];
  const seen = new Set();
  data.forEach(d => {
    const key = `${d.hotel}::${d.semana_inicio}`;
    if(!seen.has(key)){
        snapshots.push(d);
        seen.add(key);
    }
  });

  console.log(`\nSnapshots seleccionados: ${snapshots.length}`);
  snapshots.forEach(s => console.log(` - ${s.hotel} | ${s.semana_inicio} | v${s.version}`));

  // 2. Verificar Cumbria 04/05 (Sergio Vacaciones + Orden)
  const snapW1 = snapshots.find(s => s.semana_inicio === W1);
  if(snapW1){
    console.log(`\n--- Análisis ${HOTEL} ${W1} ---`);
    const emps = snapW1.snapshot_json.empleados;
    // Ordenar como lo harían index/móvil
    emps.sort((a,b) => (a.puestoOrden || a.orden || 9999) - (b.puestoOrden || b.orden || 9999));
    
    console.log('Orden de filas:');
    emps.forEach((e, i) => {
        const status = e.rowType === 'ausencia_informativa' ? '(ABSENT)' : '(OPER)';
        console.log(` [${i+1}] ${e.nombre} ${status} | pOrden: ${e.puestoOrden}`);
    });

    const sergio = emps.find(e => e.nombre.includes('Sergio'));
    if(sergio){
        const cell = sergio.dias[W1];
        console.log(`\nCelda de Sergio (${W1}):`, JSON.stringify(cell));
        const isVac = cell.type === 'VAC' || cell.code === 'VAC';
        console.log(`¿Sergio tiene VAC en Snapshot? ${isVac ? 'SÍ' : 'NO'}`);
    }
  }

  // 3. Verificar Cumbria 27/04
  const snapW2 = snapshots.find(s => s.semana_inicio === W2);
  if(snapW2){
    console.log(`\n--- Análisis ${HOTEL} ${W2} ---`);
    const emps = snapW2.snapshot_json.empleados;
    emps.sort((a,b) => (a.puestoOrden || a.orden || 9999) - (b.puestoOrden || b.orden || 9999));
    
    const substitutions = emps.filter(e => e.isSustitucion || e.nombre === 'VACANTE');
    console.log(`Sustituciones/Vacantes encontradas: ${substitutions.length}`);
    substitutions.forEach(s => console.log(` - ${s.nombre} | Original: ${s.titularOriginal}`));
    
    const absents = emps.filter(e => e.rowType === 'ausencia_informativa');
    console.log(`Filas informativas encontradas: ${absents.length}`);
    absents.forEach(a => console.log(` - ${a.nombre} (Absent)`));
  }
}

run();
