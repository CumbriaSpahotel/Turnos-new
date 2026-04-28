/**
 * CORRECCIÓN + REPUBLICACIÓN – Cumbria 04/05/2026 – v3
 * ======================================================
 * 1. Marcar v1 como reemplazado (ya debía estarlo).
 * 2. Construir snapshot V12 con fix B4 activo.
 * 3. Validar Sergio = VAC en cells.
 * 4. Publicar como v3. rollback_target = v2.
 * 5. Marcar v2 como reemplazado.
 * 6. Verificar desde BD que v3 tiene Sergio=VAC.
 *
 * NO toca: turnos, eventos_cuadrante, empleados, otras semanas.
 */
'use strict';
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
    // Soportar eventos de un solo día (fecha_inicio=fecha_fin=fecha) y rangos
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
  console.log('  CORRECCIÓN + REPUBLICACIÓN – Cumbria 04/05/2026 – v3');
  console.log('════════════════════════════════════════════════════════════\n');

  // ── 1. Ver estado actual ─────────────────────────────────────────────────
  const {data:allV}=await client.from('publicaciones_cuadrante')
    .select('id,version,estado,publicado_por,fecha_publicacion')
    .eq('hotel',HOTEL).gte('semana_fin',W_START).lte('semana_inicio',W_END)
    .order('version',{ascending:false});
  console.log('→ Versiones existentes:');
  (allV||[]).forEach(v=>console.log(`  v${v.version} id=${v.id} estado=${v.estado} publicado=${v.fecha_publicacion?.slice(0,19)}`));

  // ── 2. Corregir v1 que está activo cuando debería ser reemplazado ────────
  const v1=allV?.find(v=>v.version===1&&v.estado==='activo');
  if(v1){
    console.log(`\n→ Marcando v1 (${v1.id}) como reemplazado...`);
    const{error}=await client.from('publicaciones_cuadrante')
      .update({estado:'reemplazado',updated_at:new Date().toISOString()}).eq('id',v1.id);
    if(error) console.warn(`  ⚠️  Error: ${error.message}`);
    else console.log('  ✅ v1 marcado como reemplazado.');
  }

  const v2=allV?.find(v=>v.version===2);
  const rollbackId = v2?.id || null;
  const nextVersion = (allV?.[0]?.version||2)+1; // v3

  // ── 3. Cargar datos actuales de BD ───────────────────────────────────────
  console.log('\n→ Cargando turnos y eventos actuales...');
  const dates=[0,1,2,3,4,5,6].map(i=>addDays(W_START,i));
  const turnos=await fetchAll(()=>client.from('turnos').select('*').gte('fecha',W_START).lte('fecha',W_END).eq('hotel_id',HOTEL));
  const eventos=await fetchAll(()=>client.from('eventos_cuadrante').select('*')
    .or('estado.is.null,estado.neq.anulado').lte('fecha_inicio',W_END).or(`fecha_fin.is.null,fecha_fin.gte.${W_START}`));
  const empleados=await fetchAll(()=>client.from('empleados').select('*').order('nombre'));
  console.log(`  Turnos: ${turnos.length} | Eventos: ${eventos.length} | Empleados: ${empleados.length}`);

  // ── 4. Construir snapshot V12 con fix B4 activo ──────────────────────────
  console.log('\n→ Construyendo snapshot V12...');
  const byEmp=new Map();
  for(const t of turnos){
    if(t.hotel_id!==HOTEL)continue;
    const nid=normalizeId(t.empleado_id);
    if(!byEmp.has(nid))byEmp.set(nid,{id:t.empleado_id,fechas:{}});
    byEmp.get(nid).fechas[normalizeDate(t.fecha)]=t.turno;
  }
  // Añadir empleados con evento de ausencia aunque no tengan turno base esta semana
  for(const ev of eventos){
    if(normalizeEstado(ev.estado)==='anulado')continue;
    const tipo=normalizeTipo(ev.tipo);
    if(!['VAC','BAJA','PERM','FORM'].includes(tipo))continue;
    const evH=normalizeId(getEventoHotel(ev));
    if(evH&&evH!==normalizeId(HOTEL))continue;
    if(!ev.empleado_id)continue;
    const nid=normalizeId(ev.empleado_id);
    if(!byEmp.has(nid))byEmp.set(nid,{id:ev.empleado_id,fechas:{}});
  }

  const LABEL_MAP={VAC:'Vacaciones',BAJA:'Baja',PERM:'Permiso',FORM:'Formación'};
  const rows=[];let orden=1;
  for(const[normId,empData]of byEmp){
    if(/^---/.test(empData.id)||['¿?','?'].includes(empData.id)||empData.id.includes('_DUP'))continue;
    const profile=empleados.find(e=>normalizeId(e.id)===normId||normalizeId(e.nombre)===normId);
    const nombre=profile?.nombre||empData.id;
    if(/EMP-\d{4}/i.test(nombre))continue;

    const cells={};
    for(const fecha of dates){
      const turnoBase=empData.fechas[fecha]||null;
      const res=resolveDay({empleadoId:empData.id,hotel:HOTEL,fecha,turnoBase,eventos});
      // B4 FIX: absCode desde incidencia
      const absCode=res.incidencia==='PERMISO'?'PERM':res.incidencia==='FORMACION'?'FORM':res.incidencia||null;
      cells[fecha]={
        code:  absCode||res.turno||'',
        type:  res.incidencia||'NORMAL',
        label: absCode?LABEL_MAP[absCode]:(res.turno||'—'),
        origen:res.origen
      };
    }
    rows.push({empleado_id:empData.id,nombreVisible:nombre,nombre,orden:orden++,dias:cells,cells});
  }
  console.log(`  Filas generadas: ${rows.length}`);

  // Verificar Sergio ANTES de publicar
  const sergioRow=rows.find(r=>normalizeId(r.nombre||r.nombreVisible||r.empleado_id).includes('sergio'));
  if(!sergioRow){
    console.log('\n  ❌ SERGIO NO APARECE EN EL SNAPSHOT GENERADO.');
    console.log('  No se puede publicar. Revisar eventos en BD.');
    process.exit(1);
  }
  console.log('\n  → Verificación Sergio en snapshot generado:');
  let allVAC=true;
  dates.forEach(d=>{
    const c=sergioRow.cells[d];
    const ok=c?.code==='VAC'&&c?.type==='VAC';
    if(!ok)allVAC=false;
    console.log(`    ${d}: code="${c?.code}" type="${c?.type}" label="${c?.label}" ${ok?'✅':'❌'}`);
  });
  if(!allVAC){
    console.log('\n  ❌ SERGIO NO TIENE VAC EN TODAS LAS CELDAS. Abortando publicación.');
    console.log('  Revisar eventos_cuadrante — puede que falten días o el hotel_origen no coincida.');
    // Mostrar eventos encontrados para debug
    const evSerg=eventos.filter(ev=>normalizeId(ev.empleado_id).includes('sergio'));
    console.log(`  Eventos de Sergio encontrados: ${evSerg.length}`);
    evSerg.forEach(ev=>console.log(`    ${ev.tipo} ${ev.fecha_inicio}→${ev.fecha_fin} hotel=${ev.hotel_origen} estado=${ev.estado}`));
    process.exit(1);
  }
  console.log('\n  ✅ Sergio = VAC en los 7 días. Procediendo a publicar v3.');

  // ── 5. Publicar v3 ───────────────────────────────────────────────────────
  console.log(`\n→ Publicando v${nextVersion} (rollback→${rollbackId||'ninguno'})...`);
  const snapshotJson={
    semana_inicio:W_START,semana_fin:W_END,hotel:HOTEL,
    empleados:rows,
    source:'admin_preview_resolved',
    metadata:{rollback_target:rollbackId,published_at:new Date().toISOString(),version:nextVersion,fix:'B4_republish'}
  };
  const{data:newSnap,error:insErr}=await client.from('publicaciones_cuadrante').insert([{
    semana_inicio:W_START,semana_fin:W_END,hotel:HOTEL,
    snapshot_json:snapshotJson,
    resumen:{emps:rows.length,source:'admin_preview_resolved',fix:'B4_republish_mayo'},
    publicado_por:'ADMIN_FIX_B4',
    version:nextVersion,estado:'activo'
  }]).select().single();
  if(insErr){console.error('  ❌ Error publicando:',insErr.message);process.exit(1);}
  console.log(`  ✅ Snapshot v${nextVersion} creado. ID: ${newSnap.id}`);

  // ── 6. Marcar v2 como reemplazado ───────────────────────────────────────
  if(v2){
    const{error:upErr}=await client.from('publicaciones_cuadrante')
      .update({estado:'reemplazado',updated_at:new Date().toISOString()})
      .eq('id',v2.id);
    if(upErr)console.warn(`  ⚠️  Error marcando v2 como reemplazado: ${upErr.message}`);
    else console.log(`  ✅ v2 (${v2.id}) marcado como reemplazado.`);
  }

  // ── 7. Verificar desde BD ────────────────────────────────────────────────
  console.log('\n→ Verificación postpublicación desde BD...');
  const{data:check}=await client.from('publicaciones_cuadrante')
    .select('id,version,estado,snapshot_json').eq('id',newSnap.id).single();
  const empList=check?.snapshot_json?.empleados||[];
  const sCheck=empList.find(e=>normalizeId(e.nombre||e.nombreVisible||e.empleado_id).includes('sergio'));
  if(!sCheck){console.log('  ❌ Sergio no aparece en el snapshot verificado desde BD.');process.exit(1);}
  const c04=sCheck.cells?.['2026-05-04']||sCheck.dias?.['2026-05-04'];
  console.log(`  Sergio 04/05 en BD: code="${c04?.code}" type="${c04?.type}" label="${c04?.label}"`);
  const postOk=c04?.code==='VAC'&&c04?.type==='VAC';
  console.log(postOk?'  ✅ VERIFICACIÓN OK — Sergio=VAC en snapshot publicado.':'  ❌ FALLO — Sergio sigue sin VAC en BD.');

  // ── 8. Resumen final ─────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  RESUMEN CORRECCIÓN');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Snapshot nuevo    : ${newSnap.id}`);
  console.log(`  Versión           : v${nextVersion}`);
  console.log(`  rollback_target   : ${rollbackId||'ninguno'}`);
  console.log(`  Hotel             : ${HOTEL}`);
  console.log(`  Semana            : ${W_START} → ${W_END}`);
  console.log(`  Sergio            : ${postOk?'✅ VAC en todos los días':'❌ FALLO'}`);
  console.log(`  Filas publicadas  : ${rows.length}`);
  console.log('  ✅ No se tocó: turnos, eventos_cuadrante, empleados');
  console.log('  ✅ No se tocaron otras semanas ni hoteles');
  console.log(`  ${postOk?'✅ CORRECCIÓN COMPLETADA':'❌ CORRECCIÓN INCOMPLETA — revisar'}`);
  console.log('════════════════════════════════════════════════════════════\n');
}

run().catch(e=>{console.error('[FATAL]',e.message,e.stack);process.exit(1);});
