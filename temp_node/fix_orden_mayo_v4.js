/**
 * REPUBLICACIÓN v4 – Cumbria 04/05/2026 – ORDEN CORRECTO DEL MAPA EXCEL
 * =======================================================================
 * Problema: v3 asignó orden 1-5 alfabético. El mapa Excel define:
 *   346=Esther, 347=Sergio, 348=Cristina, 349=Valentín, 350=Isabel Hidalgo
 * Solución: usar excel_row_index del mapa como campo orden en el snapshot.
 *
 * NO toca: turnos, eventos_cuadrante, empleados, otras semanas.
 */
'use strict';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

const HOTEL   = 'Cumbria Spa&Hotel';
const W_START = '2026-05-04';
const W_END   = '2026-05-10';

// ── UTILS ─────────────────────────────────────────────────────────────────────
function addDays(iso,n){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().split('T')[0];}
function normalizeDate(v){if(!v)return'';return String(v).trim().slice(0,10);}
function normalizeId(v){if(!v)return'';return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();}
function normalizeTipo(v){const s=String(v||'').replace(/[^\x00-\x7F]/g,'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').replace(/_+$/,'');if(s.startsWith('VAC'))return'VAC';if(['BAJA','BAJA_MEDICA','BM','IT'].includes(s))return'BAJA';if(s.startsWith('PERM'))return'PERM';if(s.startsWith('FORM'))return'FORM';return s;}
function normalizeEstado(v){return/^(anulad|rechazad|cancelad)/i.test(String(v||''))?'anulado':'activo';}
function getEventoHotel(ev){return ev.hotel||ev.hotel_id||ev.hotel_origen||ev.hotel_destino||ev.payload?.hotel||ev.payload?.hotel_id||'';}

const PR={BAJA:1,VAC:2,PERM:3,PERMISO:3,FORM:4,FORMACION:4,SUSTITUCION:5,COBERTURA:5,INTERCAMBIO_TURNO:6,CT:6,CAMBIO_TURNO:6,BASE:7,SIN_TURNO:8};

function resolveDay({empleadoId,hotel,fecha,turnoBase,eventos}){
  const empId=normalizeId(empleadoId),date=normalizeDate(fecha),normH=normalizeId(hotel);
  const result={turno:turnoBase||'—',incidencia:null,origen:turnoBase?'BASE':'SIN_TURNO'};
  const activos=eventos.filter(ev=>{
    if(normalizeEstado(ev.estado)==='anulado')return false;
    const fi=normalizeDate(ev.fecha_inicio||ev.fecha);
    const ff=normalizeDate(ev.fecha_fin||ev.fecha_inicio||ev.fecha);
    if(date<fi||date>ff)return false;
    const evH=normalizeId(getEventoHotel(ev));
    if(evH&&normH&&evH!==normH)return false;
    const tipo=normalizeTipo(ev.tipo);
    const esAus=['VAC','BAJA','PERM','FORM'].includes(tipo);
    const cands=[ev.empleado_id,ev.empleado_a_id,ev.titular,ev.titular_id,ev.empleado,ev.nombre,ev.id_empleado,ev.participante_a,ev.payload?.empleado_id].filter(Boolean).map(normalizeId);
    if(!esAus)[ev.empleado_destino_id,ev.sustituto_id,ev.sustituto,ev.participante_b].filter(Boolean).forEach(x=>cands.push(normalizeId(x)));
    return cands.includes(empId);
  });
  if(!activos.length)return result;
  activos.sort((a,b)=>(PR[normalizeTipo(a.tipo)]||99)-(PR[normalizeTipo(b.tipo)]||99));
  const ev=activos[0];
  const tipo=normalizeTipo(ev.tipo);
  result.origen=tipo;
  if(['VAC','BAJA','PERM','FORM'].includes(tipo)){result.incidencia=tipo;result.turno=null;}
  return result;
}

async function fetchAll(qFn,ps=1000){const all=[];let from=0;while(true){const{data,error}=await qFn().range(from,from+ps-1);if(error)throw error;all.push(...(data||[]));if((data||[]).length<ps)break;from+=ps;}return all;}

async function run(){
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  REPUBLICACIÓN v4 – Cumbria 04/05/2026 – ORDEN CORRECTO');
  console.log('════════════════════════════════════════════════════════════\n');

  // ── 1. Cargar mapa Excel ────────────────────────────────────────────────
  const mapRaw = JSON.parse(fs.readFileSync('../data/v9_excel_order_map.json','utf8'));
  const mapArr = Array.isArray(mapRaw) ? mapRaw : Object.values(mapRaw);
  // Filtrar Cumbria semana 04/05/2026
  let mapWeek = mapArr.filter(e=>e.hotel===HOTEL&&e.week_start===W_START);
  if(!mapWeek.length){
    // Fallback: semana más próxima anterior
    const cumbriaWeeks=[...new Set(mapArr.filter(e=>e.hotel===HOTEL).map(e=>e.week_start))].sort();
    const prev=cumbriaWeeks.filter(w=>w<=W_START).pop();
    mapWeek=mapArr.filter(e=>e.hotel===HOTEL&&e.week_start===prev);
    console.log(`Usando semana de referencia del mapa: ${prev}`);
  } else {
    console.log(`Mapa exacto para ${W_START}:`);
  }
  mapWeek.sort((a,b)=>a.order-b.order);
  console.log('Orden mapa Excel:');
  mapWeek.forEach(e=>console.log(`  order=${e.order} excel_row=${e.excel_row_index} "${e.empleado_nombre||e.empleado_id}"`));

  // Construir lookup: normalizeId(nombre) → order
  const orderLookup = new Map(mapWeek.map(e=>[normalizeId(e.empleado_nombre||e.empleado_id), e.excel_row_index||e.order]));

  // ── 2. Cargar datos BD ──────────────────────────────────────────────────
  console.log('\n→ Cargando datos de BD...');
  const dates=[0,1,2,3,4,5,6].map(i=>addDays(W_START,i));
  const turnos   = await fetchAll(()=>client.from('turnos').select('*').gte('fecha',W_START).lte('fecha',W_END).eq('hotel_id',HOTEL));
  const eventos  = await fetchAll(()=>client.from('eventos_cuadrante').select('*').or('estado.is.null,estado.neq.anulado').lte('fecha_inicio',W_END).or(`fecha_fin.is.null,fecha_fin.gte.${W_START}`));
  const empleados= await fetchAll(()=>client.from('empleados').select('*').order('nombre'));
  console.log(`  Turnos: ${turnos.length} | Eventos: ${eventos.length} | Empleados: ${empleados.length}`);

  // ── 3. Construir snapshot con orden correcto del mapa ───────────────────
  console.log('\n→ Construyendo snapshot V12 con orden del mapa Excel...');
  const byEmp=new Map();
  for(const t of turnos){
    if(t.hotel_id!==HOTEL)continue;
    const nid=normalizeId(t.empleado_id);
    if(!byEmp.has(nid))byEmp.set(nid,{id:t.empleado_id,fechas:{}});
    byEmp.get(nid).fechas[normalizeDate(t.fecha)]=t.turno;
  }
  for(const ev of eventos){
    if(normalizeEstado(ev.estado)==='anulado')continue;
    if(!['VAC','BAJA','PERM','FORM'].includes(normalizeTipo(ev.tipo)))continue;
    const evH=normalizeId(getEventoHotel(ev));
    if(evH&&evH!==normalizeId(HOTEL))continue;
    if(!ev.empleado_id)continue;
    const nid=normalizeId(ev.empleado_id);
    if(!byEmp.has(nid))byEmp.set(nid,{id:ev.empleado_id,fechas:{}});
  }

  const LABEL_MAP={VAC:'Vacaciones',BAJA:'Baja',PERM:'Permiso',FORM:'Formación'};
  const FALLBACK_ORDER=1000; // empleados sin mapa van al final
  let fallbackCounter=FALLBACK_ORDER;
  const rows=[];

  for(const[normId,empData]of byEmp){
    if(/^---/.test(empData.id)||['¿?','?'].includes(empData.id)||empData.id.includes('_DUP'))continue;
    const profile=empleados.find(e=>normalizeId(e.id)===normId||normalizeId(e.nombre)===normId);
    const nombre=profile?.nombre||empData.id;
    if(/EMP-\d{4}/i.test(nombre))continue;

    // Asignar orden desde el mapa — intentar match por nombre o empleado_id
    const excelOrder = orderLookup.get(normId)
      || orderLookup.get(normalizeId(nombre))
      || (fallbackCounter++);

    const cells={};
    for(const fecha of dates){
      const turnoBase=empData.fechas[fecha]||null;
      const res=resolveDay({empleadoId:empData.id,hotel:HOTEL,fecha,turnoBase,eventos});
      const absCode=res.incidencia==='PERMISO'?'PERM':res.incidencia==='FORMACION'?'FORM':res.incidencia||null;
      cells[fecha]={
        code:  absCode||res.turno||'',
        type:  res.incidencia||'NORMAL',
        label: absCode?LABEL_MAP[absCode]:(res.turno||'—'),
        origen:res.origen
      };
    }
    rows.push({
      empleado_id:  empData.id,
      nombreVisible:nombre,
      nombre,
      orden:        excelOrder,  // ← CLAVE: orden del mapa Excel
      dias:         cells,
      cells
    });
  }

  // Ordenar por orden Excel antes de publicar
  rows.sort((a,b)=>a.orden-b.orden);

  console.log('\n  Orden en snapshot v4:');
  rows.forEach(r=>console.log(`    orden=${r.orden} "${r.nombre}"`));

  // ── 4. Validar Sergio VAC ────────────────────────────────────────────────
  const sergio=rows.find(r=>normalizeId(r.nombre).includes('sergio'));
  if(!sergio){console.log('\n❌ SERGIO NO APARECE. Abortando.'); process.exit(1);}
  const allVAC=dates.every(d=>sergio.cells[d]?.code==='VAC');
  console.log('\n  Sergio VAC: '+(allVAC?'✅ todos los días':'❌ FALLO'));
  if(!allVAC){dates.forEach(d=>console.log(`    ${d}: code="${sergio.cells[d]?.code}"`)); process.exit(1);}

  // ── 5. Obtener v3 para rollback ─────────────────────────────────────────
  const{data:current}=await client.from('publicaciones_cuadrante').select('id,version')
    .eq('hotel',HOTEL).eq('estado','activo').gte('semana_fin',W_START).lte('semana_inicio',W_START)
    .order('version',{ascending:false}).limit(1);
  const rollbackId=current?.[0]?.id||null;
  const nextVersion=(current?.[0]?.version||3)+1;
  console.log(`\n→ Publicando v${nextVersion} (rollback→${rollbackId||'ninguno'})...`);

  // ── 6. Publicar v4 ──────────────────────────────────────────────────────
  const snapshotJson={
    semana_inicio:W_START,semana_fin:W_END,hotel:HOTEL,
    empleados:rows,
    source:'admin_preview_resolved',
    metadata:{rollback_target:rollbackId,published_at:new Date().toISOString(),version:nextVersion,fix:'B4+orden_mapa_excel'}
  };
  const{data:newSnap,error:insErr}=await client.from('publicaciones_cuadrante').insert([{
    semana_inicio:W_START,semana_fin:W_END,hotel:HOTEL,
    snapshot_json:snapshotJson,
    resumen:{emps:rows.length,source:'admin_preview_resolved',fix:'orden_mapa_excel_v4'},
    publicado_por:'ADMIN_FIX_ORDEN',
    version:nextVersion,estado:'activo'
  }]).select().single();
  if(insErr){console.error('❌ Error publicando:',insErr.message);process.exit(1);}
  console.log(`✅ Snapshot v${nextVersion} creado. ID: ${newSnap.id}`);

  // ── 7. Verificar desde BD ────────────────────────────────────────────────
  console.log('\n→ Verificación postpublicación...');
  const{data:check}=await client.from('publicaciones_cuadrante').select('id,version,snapshot_json').eq('id',newSnap.id).single();
  const checkEmps=check?.snapshot_json?.empleados||[];
  console.log('  Orden verificado en BD:');
  [...checkEmps].sort((a,b)=>a.orden-b.orden).forEach(e=>console.log(`    orden=${e.orden} "${e.nombre||e.nombreVisible}"`));
  const c04=checkEmps.find(e=>normalizeId(e.nombre||e.nombreVisible).includes('sergio'))?.cells?.['2026-05-04'];
  const postVAC=c04?.code==='VAC';

  // ── 8. Resumen ──────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  RESUMEN REPUBLICACIÓN v4');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Snapshot nuevo   : ${newSnap.id}`);
  console.log(`  Versión          : v${nextVersion}`);
  console.log(`  rollback_target  : ${rollbackId||'ninguno (v3)'}`);
  console.log(`  Filas            : ${rows.length}`);
  console.log(`  Sergio VAC       : ${postVAC?'✅':'❌'}`);
  console.log('  Orden publicado  :');
  rows.forEach(r=>console.log(`    ${r.orden} → ${r.nombre}`));
  console.log('  Orden mapa Excel :');
  mapWeek.forEach(e=>console.log(`    ${e.excel_row_index||e.order} → ${e.empleado_nombre||e.empleado_id}`));
  console.log('  ✅ No se tocó: turnos, eventos_cuadrante, empleados');
  console.log('  ✅ No se tocaron otras semanas');
  console.log('════════════════════════════════════════════════════════════\n');
}

run().catch(e=>{console.error('[FATAL]',e.message);process.exit(1);});
