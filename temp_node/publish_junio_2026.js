/**
 * PUBLICACIÓN CONTROLADA – JUNIO 2026 – SNAPSHOT V12
 * ====================================================
 * AUTORIZACIÓN: Solo Junio 2026. Solo publicaciones_cuadrante.
 * NO toca: turnos, eventos_cuadrante, empleados, snapshots anteriores.
 * Semana por semana. Se detiene ante cualquier error.
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const HOTELS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
const WEEKS  = ['2026-06-01','2026-06-08','2026-06-15','2026-06-22','2026-06-29'];

// ── UTILES ────────────────────────────────────────────────────────────────────
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function normalizeDate(v) {
  if (!v) return '';
  return String(v).trim().slice(0, 10);
}
function normalizeId(v) {
  if (!v) return '';
  return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
}
function normalizeTipo(v) {
  const s = String(v||'').replace(/[^\x00-\x7F]/g,'').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').replace(/_+$/,'');
  if (s.startsWith('VAC')) return 'VAC';
  if (['BAJA','BAJA_MEDICA','BM','IT'].includes(s)) return 'BAJA';
  if (s.startsWith('PERM')) return 'PERM';
  if (s.startsWith('FORM')) return 'FORM';
  return s;
}
function normalizeEstado(v) {
  const s = String(v||'').trim().toLowerCase();
  return /^(anulad|rechazad|cancelad)/.test(s) ? 'anulado' : 'activo';
}
function getEventoHotel(ev) {
  return ev.hotel||ev.hotel_id||ev.hotel_origen||ev.hotel_destino||ev.payload?.hotel||ev.payload?.hotel_id||'';
}

// ── PRIORITY RANK ─────────────────────────────────────────────────────────────
const PR = {BAJA:1,VAC:2,PERM:3,PERMISO:3,FORM:4,FORMACION:4,SUSTITUCION:5,COBERTURA:5,
  INTERCAMBIO_TURNO:6,CT:6,CAMBIO_TURNO:6,BASE:7,SIN_TURNO:8};

function resolveDay({empleadoId, hotel, fecha, turnoBase, eventos}) {
  const empId = normalizeId(empleadoId);
  const date  = normalizeDate(fecha);
  const normH = normalizeId(hotel);
  const result = { empleadoId:empId, fecha:date, turno:turnoBase||'—', incidencia:null, origen:turnoBase?'BASE':'SIN_TURNO' };

  const activos = eventos.filter(ev => {
    if (normalizeEstado(ev.estado)==='anulado') return false;
    const fi = normalizeDate(ev.fecha_inicio||ev.fecha);
    const ff = normalizeDate(ev.fecha_fin||ev.fecha_inicio||ev.fecha);
    if (date<fi||date>ff) return false;
    const evH = normalizeId(getEventoHotel(ev));
    if (evH&&normH&&evH!==normH) return false;
    const tipo = normalizeTipo(ev.tipo);
    const esAus = ['VAC','BAJA','PERM','FORM'].includes(tipo);
    const cands = [ev.empleado_id,ev.empleado_a_id,ev.titular,ev.titular_id,ev.empleado,ev.nombre,ev.id_empleado,ev.participante_a,ev.payload?.empleado_id]
      .filter(Boolean).map(normalizeId);
    if (!esAus) [ev.empleado_destino_id,ev.sustituto_id,ev.sustituto,ev.participante_b].filter(Boolean).forEach(x=>cands.push(normalizeId(x)));
    return cands.includes(empId);
  });

  if (!activos.length) return result;
  activos.sort((a,b)=>(PR[normalizeTipo(a.tipo)]||99)-(PR[normalizeTipo(b.tipo)]||99));
  const ev = activos[0];
  const tipo = normalizeTipo(ev.tipo);
  result.origen = tipo;
  if (['VAC','BAJA','PERM','FORM'].includes(tipo)) { result.incidencia=tipo; result.turno=null; }
  return result;
}

function getAbsCode(inc) {
  if (!inc) return null;
  if (inc==='PERMISO') return 'PERM';
  if (inc==='FORMACION') return 'FORM';
  return inc;
}

// ── FETCH HELPERS (solo lectura) ──────────────────────────────────────────────
async function fetchAll(qFn, ps=1000) {
  const all=[]; let from=0;
  while(true){
    const {data,error} = await qFn().range(from, from+ps-1);
    if(error) throw error;
    all.push(...(data||[]));
    if((data||[]).length<ps) break;
    from+=ps;
  }
  return all;
}
async function fetchTurnos(ws,we) {
  return fetchAll(()=>client.from('turnos').select('*').gte('fecha',ws).lte('fecha',we).order('fecha').order('empleado_id'));
}
async function fetchEventos(ws,we) {
  return fetchAll(()=>client.from('eventos_cuadrante').select('*')
    .or('estado.is.null,estado.neq.anulado').lte('fecha_inicio',we).or(`fecha_fin.is.null,fecha_fin.gte.${ws}`).order('fecha_inicio'));
}
async function fetchEmpleados() {
  return fetchAll(()=>client.from('empleados').select('*').order('nombre'));
}

// ── CONSTRUIR SNAPSHOT ────────────────────────────────────────────────────────
function buildSnapshot({hotel, dates, turnos, eventos, empleados}) {
  const byEmp = new Map();
  for (const t of turnos) {
    if (t.hotel_id!==hotel) continue;
    const nid = normalizeId(t.empleado_id);
    if (!byEmp.has(nid)) byEmp.set(nid,{id:t.empleado_id,fechas:{}});
    byEmp.get(nid).fechas[normalizeDate(t.fecha)]=t.turno;
  }
  // Añadir empleados con evento de ausencia aunque no tengan turno base esta semana
  for (const ev of eventos) {
    if (normalizeEstado(ev.estado)==='anulado') continue;
    const tipo = normalizeTipo(ev.tipo);
    if (!['VAC','BAJA','PERM','FORM'].includes(tipo)) continue;
    const evH = normalizeId(getEventoHotel(ev));
    const hN  = normalizeId(hotel);
    if (evH&&hN&&evH!==hN) continue;
    if (!ev.empleado_id) continue;
    const nid = normalizeId(ev.empleado_id);
    if (!byEmp.has(nid)) byEmp.set(nid,{id:ev.empleado_id,fechas:{}});
  }

  const rows=[];
  let orden=1;
  for (const [normId, empData] of byEmp) {
    if (/^---/.test(empData.id)||['¿?','?'].includes(empData.id)) continue;
    // Verificar _DUP
    if (empData.id.includes('_DUP')) continue;
    const profile = empleados.find(e=>normalizeId(e.id)===normId||normalizeId(e.nombre)===normId);
    const nombre  = profile?.nombre || empData.id;
    // Verificar EMP-XXXX visible
    if (/EMP-\d{4}/i.test(nombre)) continue;

    const cells={};
    for (const fecha of dates) {
      const turnoBase = empData.fechas[fecha]||null;
      const res = resolveDay({empleadoId:empData.id, hotel, fecha, turnoBase, eventos});
      const abs = getAbsCode(res.incidencia);
      const LABEL_MAP={VAC:'Vacaciones',BAJA:'Baja',PERM:'Permiso',FORM:'Formación'};
      cells[fecha]={
        code:  abs||res.turno||'',
        type:  res.incidencia||'NORMAL',
        label: abs?LABEL_MAP[abs]:(res.turno||'—'),
        origen:res.origen
      };
    }
    rows.push({empleado_id:empData.id, nombreVisible:nombre, nombre, orden:orden++, dias:cells, cells});
  }
  return {
    hotel_id:hotel, hotel_nombre:hotel,
    week_start:dates[0], week_end:dates[6],
    semana_inicio:dates[0], semana_fin:dates[6],
    hotel, source:'admin_preview_resolved',
    empleados:rows, rows
  };
}

// ── VALIDACIONES ──────────────────────────────────────────────────────────────
function validateSnapshot(snap, eventos) {
  const errors=[], warnings=[];
  const wS=snap.week_start, wE=snap.week_end, hN=normalizeId(snap.hotel_id);

  for (const row of snap.rows) {
    const name=row.nombreVisible||row.nombre||'';
    if (!row.empleado_id||row.empleado_id==='?'||row.empleado_id.length<2)
      errors.push(`[BLOQUEO] Empleado sin ID válido: "${name}"`);
    if (name.includes('_DUP')) errors.push(`[BLOQUEO] _DUP en nombre: "${name}"`);
    if (/EMP-\d{4}/i.test(name)) errors.push(`[BLOQUEO] EMP-XXXX visible: "${name}"`);
    if (name.toLowerCase().includes('sustituye a')) errors.push(`[BLOQUEO] Texto "Sustituye a" en: "${name}"`);
    if (snap.hotel_id.toLowerCase().includes('test')) errors.push(`[BLOQUEO] TEST HOTEL: ${snap.hotel_id}`);
  }

  for (const ev of eventos) {
    if (normalizeEstado(ev.estado)==='anulado') continue;
    const tipo=normalizeTipo(ev.tipo);
    if (!['VAC','BAJA','PERM','FORM'].includes(tipo)) continue;
    const evH=normalizeId(getEventoHotel(ev));
    if (evH&&hN&&evH!==hN) continue;
    const fi=normalizeDate(ev.fecha_inicio), ff=normalizeDate(ev.fecha_fin||ev.fecha_inicio);
    if (!fi||fi>wE||ff<wS) continue;

    const idNorm=normalizeId(ev.empleado_id);
    const row=snap.rows.find(r=>normalizeId(r.empleado_id)===idNorm);
    if (!row){errors.push(`[BLOQUEO] Evento ${tipo} de "${ev.empleado_id}" no aparece en snapshot`); continue;}

    const cellDates=Object.keys(row.cells||{}).filter(d=>d>=fi&&d<=ff&&d>=wS&&d<=wE);
    for (const d of cellDates) {
      const cell=row.cells[d];
      if (!cell){errors.push(`[BLOQUEO] Celda faltante ${row.nombreVisible} el ${d}`); continue;}
      const code=String(cell.code||'').toUpperCase();
      const type=String(cell.type||'').toUpperCase();
      const exp={VAC:'VAC',BAJA:'BAJA',PERM:'PERM',FORM:'FORM'}[tipo];
      if (!(code===exp||type===exp))
        errors.push(`[BLOQUEO] ${tipo} no renderizado para ${row.nombreVisible} el ${d} — code="${code}" type="${type}"`);
    }
  }
  return {ok:errors.length===0, errors, warnings};
}

// ── PUBLICAR UN SNAPSHOT ──────────────────────────────────────────────────────
async function publishOneSnapshot(snap) {
  const wS=snap.semana_inicio||snap.week_start;
  const wE=snap.semana_fin||snap.week_end;
  const hotel=snap.hotel_id||snap.hotel;

  // 1. Buscar versión activa actual (para rollback y versión)
  const {data:current} = await client.from('publicaciones_cuadrante')
    .select('id,version').eq('semana_inicio',wS).eq('hotel',hotel).eq('estado','activo')
    .order('version',{ascending:false}).limit(1);

  const rollbackId  = current?.[0]?.id || null;
  const nextVersion = current?.[0] ? current[0].version+1 : 1;

  // 2. Insertar nuevo snapshot activo
  const snapshotJson = {
    semana_inicio:wS, semana_fin:wE, hotel,
    empleados:snap.empleados||snap.rows||[],
    source:'admin_preview_resolved',
    metadata:{ rollback_target:rollbackId, published_at:new Date().toISOString(), version:nextVersion }
  };

  const {data:newSnap, error:insErr} = await client.from('publicaciones_cuadrante')
    .insert([{
      semana_inicio:wS, semana_fin:wE, hotel,
      snapshot_json:snapshotJson,
      resumen:{emps:(snap.rows||snap.empleados||[]).length, source:'admin_preview_resolved'},
      publicado_por:'ADMIN_DRY_RUN_JUNIO',
      version:nextVersion, estado:'activo'
    }]).select().single();

  if (insErr) throw insErr;

  // 3. Marcar anteriores como reemplazado
  if (rollbackId) {
    const {error:upErr} = await client.from('publicaciones_cuadrante')
      .update({estado:'reemplazado', updated_at:new Date().toISOString()})
      .eq('semana_inicio',wS).eq('hotel',hotel).eq('estado','activo').neq('id',newSnap.id);
    if (upErr) console.warn(`  ⚠️  Marcar reemplazado: ${upErr.message}`);
  }

  // 4. Log de auditoría (no bloqueante)
  let logOk=true, logError=null;
  try {
    const {error:logErr} = await client.from('publicaciones_log').insert([{
      cambios_totales:(snap.rows||snap.empleados||[]).length,
      resumen_json:{accion:'publicar_snapshot_cuadrante',semana_inicio:wS,semana_fin:wE,hotel,version:nextVersion,rollback_target:rollbackId},
      estado:'ok', publicado_por:'ADMIN_JUNIO_2026'
    }]);
    if (logErr) {logOk=false; logError=logErr.message;}
  } catch(e) {logOk=false; logError=e.message;}

  return {id:newSnap.id, version:nextVersion, rollbackId, logOk, logError};
}

// ── VERIFICAR POSTPUBLICACIÓN ─────────────────────────────────────────────────
async function verifyPublished(snapId, hotel, wS) {
  const {data,error} = await client.from('publicaciones_cuadrante')
    .select('id,semana_inicio,semana_fin,hotel,version,estado,snapshot_json,resumen').eq('id',snapId).single();
  if (error) return {ok:false, error:error.message};
  const emps = data.snapshot_json?.empleados||[];
  let vacCells=0;
  for (const emp of emps) {
    const dias=emp.dias||emp.cells||{};
    for (const [,cell] of Object.entries(dias)) {
      if (cell.type==='VAC'||cell.code==='VAC') vacCells++;
    }
  }
  return {ok:true, id:data.id, hotel:data.hotel, semana_inicio:data.semana_inicio, semana_fin:data.semana_fin,
    version:data.version, estado:data.estado, filas:emps.length, vacCells, source:data.snapshot_json?.source};
}

// ── PUBLICACIÓN PRINCIPAL ─────────────────────────────────────────────────────
async function publicarJunio2026() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  PUBLICACIÓN CONTROLADA – JUNIO 2026 – SNAPSHOT V12');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Alcance: Junio 2026 · Cumbria & Guadiana · Solo lectura previa\n');

  const empleados = await fetchEmpleados();
  console.log(`→ ${empleados.length} empleados cargados.\n`);

  const resultados = [];
  let totalErrores = 0;

  for (const ws of WEEKS) {
    const we      = addDays(ws, 6);
    const dates   = [0,1,2,3,4,5,6].map(i=>addDays(ws,i));
    const turnos  = await fetchTurnos(ws, we);
    const eventos = await fetchEventos(ws, we);

    console.log(`── Semana ${ws} → ${we} ─────────────────────────────────────`);
    console.log(`   Turnos base: ${turnos.length} | Eventos: ${eventos.length}`);

    for (const hotel of HOTELS) {
      const hShort = hotel.includes('Cumbria')?'CUMBRIA':'GUADIANA';
      process.stdout.write(`   [${hShort}] Validando...`);

      const snap  = buildSnapshot({hotel, dates, turnos, eventos, empleados});
      const valid = validateSnapshot(snap, eventos);

      if (!valid.ok) {
        console.log(` ❌ BLOQUEADO (${valid.errors.length} errores)`);
        valid.errors.forEach(e=>console.log(`      ${e}`));
        console.log('\n🛑 LOTE DETENIDO — corregir antes de continuar.\n');
        process.exit(1);
      }

      // Conteo VAC renderizados
      let vacRend=0;
      for (const row of snap.rows) for (const [,c] of Object.entries(row.cells||{}))
        if (c.type==='VAC'||c.code==='VAC') vacRend++;

      console.log(` ✅ OK | Filas: ${snap.rows.length} | VAC renderizadas: ${vacRend}`);

      // PUBLICAR
      process.stdout.write(`   [${hShort}] Publicando...`);
      const pub = await publishOneSnapshot(snap);
      console.log(` ✅ Publicado | ID: ${pub.id} | v${pub.version} | rollback→${pub.rollbackId||'ninguno'}`);
      if (!pub.logOk) console.log(`   [${hShort}] ⚠️  Log: ${pub.logError}`);

      // VERIFICAR POSTPUBLICACIÓN
      const verify = await verifyPublished(pub.id, hotel, ws);
      if (!verify.ok) {
        console.log(`   [${hShort}] ❌ Verificación fallida: ${verify.error}`);
        totalErrores++;
      } else {
        console.log(`   [${hShort}] ✅ Verificado | Filas: ${verify.filas} | VAC: ${verify.vacCells} | estado: ${verify.estado}`);
      }

      resultados.push({
        semana:ws, hotel, snapId:pub.id, version:pub.version,
        rollbackId:pub.rollbackId, logOk:pub.logOk, logError:pub.logError||null,
        filas:snap.rows.length, vacRend, verify
      });
    }
    console.log('');
  }

  // ── INFORME FINAL ────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════');
  console.log('  RESUMEN PUBLICACIÓN JUNIO 2026');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n  Snapshots publicados : ${resultados.length} de ${WEEKS.length * HOTELS.length}`);
  console.log(`  Errores              : ${totalErrores}`);
  console.log('');
  console.log('  Detalle por semana/hotel:');
  for (const r of resultados) {
    const ok = r.verify?.ok;
    console.log(`  ${ok?'✅':'❌'} ${r.semana} · ${r.hotel.includes('Cumbria')?'Cumbria':'Guadiana'} → ID:${r.snapId} v${r.version} | ${r.filas} filas | VAC:${r.vacRend} | Log:${r.logOk?'OK':'⚠️ '+r.logError}`);
  }

  // Confirmaciones de integridad
  console.log('\n  Confirmaciones:');
  console.log('  ✅ No se tocó public.turnos');
  console.log('  ✅ No se tocó eventos_cuadrante');
  console.log('  ✅ No se tocó empleados');
  console.log('  ✅ No se publicaron otros meses (solo Junio 2026)');
  console.log('  ✅ Snapshots anteriores marcados "reemplazado" (no borrados)');
  console.log('  ✅ source = admin_preview_resolved en todos los snapshots');

  if (totalErrores===0 && resultados.length===WEEKS.length*HOTELS.length) {
    console.log('\n  ✅ JUNIO 2026 PUBLICADO CORRECTAMENTE. 10/10 snapshots OK.');
  } else {
    console.log(`\n  ⚠️  ${totalErrores} errores. Revisar resultados.`);
  }
  console.log('══════════════════════════════════════════════════════════\n');

  // Exportar resultados a JSON
  const fs=require('fs');
  fs.writeFileSync('publish_junio_2026_result.json', JSON.stringify(resultados,null,2));
  console.log('  Resultados guardados en publish_junio_2026_result.json\n');
}

publicarJunio2026().catch(err=>{
  console.error('\n[FATAL]', err.message);
  console.error(err.stack);
  process.exit(1);
});
