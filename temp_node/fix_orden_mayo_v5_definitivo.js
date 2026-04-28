/**
 * REPUBLICACIÓN v5 DEFINITIVA – Cumbria 04/05/2026
 * =======================================================================
 * Implementa las reglas de oro del PROMPT DEFINITIVO:
 * 1. Los sustitutos heredan la posición del titular.
 * 2. Si no hay sustituto, el puesto queda como "VACANTE".
 * 3. El titular ausente se mueve a "absentRows" al final.
 * 4. El orden se basa estrictamente en el Mapa Excel V9.
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
    const esAusencia=['VAC','BAJA','PERM','FORM'].includes(tipo);
    const cands=[ev.empleado_id,ev.empleado_a_id,ev.titular,ev.titular_id,ev.empleado,ev.nombre,ev.id_empleado,ev.participante_a,ev.payload?.empleado_id].filter(Boolean).map(normalizeId);
    if(!esAusencia)[ev.empleado_destino_id,ev.sustituto_id,ev.sustituto,ev.participante_b].filter(Boolean).forEach(x=>cands.push(normalizeId(x)));
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
  console.log('→ Cargando datos...');
  const mapRaw = JSON.parse(fs.readFileSync('../data/v9_excel_order_map.json','utf8'));
  const mapArr = Array.isArray(mapRaw) ? mapRaw : Object.values(mapRaw);
  const mapWeek=mapArr.filter(e=>e.hotel===HOTEL && (e.week_start===W_START || e.week_start==='2026-06-01')).sort((a,b)=>a.order-b.order);
  
  const turnos   = await fetchAll(()=>client.from('turnos').select('*').gte('fecha',W_START).lte('fecha',W_END).eq('hotel_id',HOTEL));
  const eventos  = await fetchAll(()=>client.from('eventos_cuadrante').select('*').or('estado.is.null,estado.neq.anulado').lte('fecha_inicio',W_END).or(`fecha_fin.is.null,fecha_fin.gte.${W_START}`));
  const empleados= await fetchAll(()=>client.from('empleados').select('*'));
  
  const dates=[0,1,2,3,4,5,6].map(i=>addDays(W_START,i));
  const weekStatus=new Map();
  const substitutesMap=new Map();
  
  eventos.forEach(ev=>{
    const tipo=normalizeTipo(ev.tipo);
    if(!['VAC','BAJA','PERM','FORM'].includes(tipo))return;
    const fi=normalizeDate(ev.fecha_inicio);
    const ff=normalizeDate(ev.fecha_fin||ev.fecha_inicio);
    if(!dates.some(d=>d>=fi&&d<=ff))return;
    const tId=ev.empleado_id; if(!tId)return;
    const normT=normalizeId(tId);
    const sRaw=ev.empleado_destino_id||ev.sustituto_id||ev.sustituto||ev.payload?.sustituto_id||ev.payload?.sustituto;
    const normS=sRaw?normalizeId(sRaw):null;
    weekStatus.set(normT,{tipo,sustitutoId:normS,rawSust:sRaw,titularId:tId,event_id:ev.id});
    if(normS)substitutesMap.set(normS,normT);
  });

  const operationalRows=[];
  const absentRows=[];
  const assignedNorms=new Set();
  
  // Usar los empleados que tienen turnos en esta semana (sourceRows simulado)
  const sourceRows = [];
  const empsInTurnos = [...new Set(turnos.map(t=>t.empleado_id))];
  empsInTurnos.forEach(eid=>{
    const profile=empleados.find(e=>normalizeId(e.id)===normalizeId(eid)||normalizeId(e.nombre)===normalizeId(eid));
    const v9Item = mapWeek.find(m=>normalizeId(m.empleado_nombre||m.empleado_id)===normalizeId(profile?.nombre||eid));
    sourceRows.push({
      empleadoId: eid,
      nombre: profile?.nombre||eid,
      order: v9Item?.excel_row_index || v9Item?.order || 500,
      turnos: turnos.filter(t=>t.empleado_id===eid)
    });
  });
  // Añadir los que no tienen turnos pero están en el mapa (pueden estar de VAC)
  mapWeek.forEach(m=>{
    const normM = normalizeId(m.empleado_nombre||m.empleado_id);
    if(!sourceRows.some(s=>normalizeId(s.nombre)===normM)){
      sourceRows.push({
        empleadoId: m.empleado_id,
        nombre: m.empleado_nombre || m.empleado_id,
        order: m.excel_row_index || m.order || 500,
        turnos: []
      });
    }
  });
  sourceRows.sort((a,b)=>a.order-b.order);

  sourceRows.forEach(r=>{
    const normT=normalizeId(r.nombre);
    const status=weekStatus.get(normT);
    if(status){
      // Info Row
      absentRows.push({
        nombre: r.nombre, empleado_id: r.empleadoId, rowType:'ausencia_informativa', puestoOrden: r.order+1000,
        dias: buildCells(r.empleadoId, r.turnos, eventos, dates)
      });
      // Operational Spot
      let occId=status.sustitutoId?status.rawSust:('VACANTE-'+normT);
      let isVacante=!status.sustitutoId;
      if(!isVacante && assignedNorms.has(normalizeId(occId))){ occId='VACANTE-'+normT; isVacante=true; }
      
      operationalRows.push({
        nombre: isVacante?'VACANTE':(empleados.find(e=>normalizeId(e.id)===normalizeId(occId)||normalizeId(e.nombre)===normalizeId(occId))?.nombre||occId),
        empleado_id: occId, isVacante, rowType:'operativo', puestoOrden: r.order,
        dias: buildCells(occId, [], eventos, dates, isVacante?null:r.empleadoId)
      });
      if(!isVacante)assignedNorms.add(normalizeId(occId));
    } else {
      if(substitutesMap.has(normT))return;
      if(!assignedNorms.has(normT)){
        operationalRows.push({
          nombre: r.nombre, empleado_id: r.empleadoId, rowType:'operativo', puestoOrden: r.order,
          dias: buildCells(r.empleadoId, r.turnos, eventos, dates)
        });
        assignedNorms.add(normT);
      }
    }
  });

  const finalRows = [...operationalRows, ...absentRows].sort((a,b)=>a.puestoOrden-b.puestoOrden);
  const{data:curr}=await client.from('publicaciones_cuadrante').select('version').eq('hotel',HOTEL).eq('semana_inicio',W_START).order('version',{ascending:false}).limit(1);
  const nextV = (curr?.[0]?.version||4)+1;
  
  const snapshotJson={ semana_inicio:W_START,semana_fin:W_END,hotel:HOTEL,empleados:finalRows,source:'admin_preview_resolved',version:nextV };
  const{data:newSnap,error}=await client.from('publicaciones_cuadrante').insert([{
    semana_inicio:W_START,semana_fin:W_END,hotel:HOTEL,snapshot_json:snapshotJson,version:nextV,estado:'activo',publicado_por:'FIX_V5_DEFINITIVO'
  }]).select().single();
  
  if(error) console.error('Error:',error.message);
  else console.log(`✅ Snapshot v${nextV} publicado con éxito. ID: ${newSnap.id}`);
}

function buildCells(empId, tList, eventos, dates, titularCubierto=null){
  const res={};
  dates.forEach(f=>{
    const tBase=tList.find(t=>normalizeDate(t.fecha)===f)?.turno||null;
    const r=resolveDay({empleadoId:empId,hotel:HOTEL,fecha:f,turnoBase:tBase,eventos});
    const absCode=r.incidencia==='PERMISO'?'PERM':r.incidencia==='FORMACION'?'FORM':r.incidencia||null;
    res[f]={
      code:absCode||r.turno||'', type:r.incidencia||'NORMAL',
      label:absCode?({VAC:'Vacaciones',BAJA:'Baja',PERM:'Permiso',FORM:'Formación'}[absCode]):(r.turno||'—'),
      titular_cubierto: titularCubierto
    };
  });
  return res;
}

run();
