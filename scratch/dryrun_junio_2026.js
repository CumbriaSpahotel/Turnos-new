/**
 * DRY RUN – JUNIO 2026 – EVENTO → SNAPSHOT → INDEX
 * =====================================================
 * SOLO LECTURA. No escribe nada en Supabase.
 * No publica. No inserta. No modifica.
 *
 * Simula buildPublicationSnapshotPreview() + validatePublicationSnapshot()
 * para cada semana de Junio 2026 y reporta métricas de eventos perdidos.
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');

// ── CONEXIÓN ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const client        = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const HOTELS    = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
const JUNE_START = '2026-06-01';
const JUNE_END   = '2026-06-30';

const ABSENCE_TYPES = new Set(['VAC','VACACIONES','BAJA','IT','PERMISO','PERM','FORMACION','FORM']);
const NORM_MAP = {
  VAC:'VAC', VACACIONES:'VAC',
  BAJA:'BAJA', IT:'BAJA',
  PERMISO:'PERM', PERM:'PERM',
  FORMACION:'FORM', FORM:'FORM'
};

// ── UTILIDADES ────────────────────────────────────────────────────────────────
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().split('T')[0];
}

function buildWeeksInRange(startIso, endIso) {
  const weeks = [];
  let ws = mondayOf(startIso);
  while (ws <= endIso) {
    const we = addDays(ws, 6);
    weeks.push({ start: ws, end: we });
    ws = addDays(ws, 7);
  }
  return weeks;
}

function normalizeDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.split(/[T ]/)[0];
}

function normalizeId(v) {
  if (!v) return '';
  return String(v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeTipo(v) {
  const s = String(v || '')
    .replace(/[^\x00-\x7F]/g, '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_').replace(/_+$/, '');
  if (s.startsWith('VAC')) return 'VAC';
  if (['BAJA','BAJA_MEDICA','BM','IT'].includes(s)) return 'BAJA';
  if (s.startsWith('PERM')) return 'PERM';
  if (s.startsWith('FORM')) return 'FORM';
  return s;
}

function normalizeEstado(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return 'activo';
  if (/^(anulad|rechazad|cancelad)/.test(s)) return 'anulado';
  return 'activo';
}

function getEventoHotel(ev) {
  return ev.hotel || ev.hotel_id || ev.hotel_origen || ev.hotel_destino ||
    ev.payload?.hotel || ev.payload?.hotel_id || ev.payload?.hotel_origen || '';
}

// ── FETCH SUPABASE (solo lectura) ─────────────────────────────────────────────
async function fetchAll(queryFn, pageSize = 1000) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFn().range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if ((data || []).length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchTurnos(weekStart, weekEnd) {
  return fetchAll(() =>
    client.from('turnos').select('*')
      .gte('fecha', weekStart).lte('fecha', weekEnd)
      .order('fecha').order('empleado_id')
  );
}

async function fetchEventos(weekStart, weekEnd) {
  return fetchAll(() =>
    client.from('eventos_cuadrante').select('*')
      .or('estado.is.null,estado.neq.anulado')
      .lte('fecha_inicio', weekEnd)
      .or(`fecha_fin.is.null,fecha_fin.gte.${weekStart}`)
      .order('fecha_inicio')
  );
}

async function fetchEmpleados() {
  return fetchAll(() =>
    client.from('empleados').select('*').order('nombre')
  );
}

// ── RESOLVER SIMPLIFICADO (sin DOM) ──────────────────────────────────────────
/**
 * Replica resolveEmployeeDay del shift-resolver.js para uso en Node.
 * Prioridad: BAJA(1) > VAC(2) > PERM(3) > FORM(4) > SUSTITUCION(5) > CT(6) > BASE(7) > —(8)
 */
const PRIORITY_RANK = {
  BAJA:1, VAC:2, PERM:3, PERMISO:3, FORM:4, FORMACION:4,
  SUSTITUCION:5, COBERTURA:5, INTERCAMBIO_TURNO:6, CT:6, CAMBIO_TURNO:6,
  BASE:7, SIN_TURNO:8
};

function resolveDay({ empleadoId, hotel, fecha, turnoBase, eventos }) {
  const empId   = normalizeId(empleadoId);
  const date    = normalizeDate(fecha);
  const normHotel = normalizeId(hotel);

  let result = {
    empleadoId: empId, fecha: date, hotel: normHotel,
    turno: turnoBase || '—', turnoBase: turnoBase || null,
    incidencia: null, origen: turnoBase ? 'BASE' : 'SIN_TURNO'
  };

  const activos = eventos.filter(ev => {
    if (normalizeEstado(ev.estado) === 'anulado') return false;
    // Rango de fechas
    const fi = normalizeDate(ev.fecha_inicio || ev.fecha);
    const ff = normalizeDate(ev.fecha_fin || ev.fecha_inicio || ev.fecha);
    if (date < fi || date > ff) return false;
    // Hotel
    const evH = normalizeId(getEventoHotel(ev));
    if (evH && normHotel && evH !== normHotel) return false;
    // Empleado (solo titular para ausencias)
    const tipo = normalizeTipo(ev.tipo);
    const esAusencia = ['VAC','BAJA','PERM','FORM'].includes(tipo);
    const campos = [
      ev.empleado_id, ev.empleado_a_id, ev.titular, ev.titular_id,
      ev.empleado, ev.nombre, ev.id_empleado, ev.participante_a,
      ev.payload?.empleado_id
    ].filter(Boolean).map(normalizeId);
    if (!esAusencia) {
      [ev.empleado_destino_id, ev.sustituto_id, ev.sustituto,
       ev.participante_b, ev.payload?.sustituto_id].filter(Boolean).forEach(x => campos.push(normalizeId(x)));
    }
    return campos.includes(empId);
  });

  if (activos.length === 0) return result;

  activos.sort((a, b) =>
    (PRIORITY_RANK[normalizeTipo(a.tipo)] || 99) - (PRIORITY_RANK[normalizeTipo(b.tipo)] || 99)
  );

  const ev   = activos[0];
  const tipo = normalizeTipo(ev.tipo);
  result.evento = ev;
  result.origen = tipo;

  if (['VAC','BAJA','PERM','FORM'].includes(tipo)) {
    result.incidencia = tipo === 'PERM' ? 'PERM' : tipo === 'FORM' ? 'FORM' : tipo;
    result.turno = null;
  }

  return result;
}

// ── CONSTRUIR absCode ─────────────────────────────────────────────────────────
function getAbsCode(incidencia) {
  if (!incidencia) return null;
  if (incidencia === 'PERMISO') return 'PERM';
  if (incidencia === 'FORMACION') return 'FORM';
  return incidencia;
}

// ── SNAPSHOT SIMULADO ─────────────────────────────────────────────────────────
function buildSnapshotForHotel({ hotel, dates, turnos, eventos, empleados }) {
  // Agrupar turnos por empleado
  const byEmp = new Map();
  for (const t of turnos) {
    if (t.hotel_id !== hotel) continue;
    const normId = normalizeId(t.empleado_id);
    if (!byEmp.has(normId)) byEmp.set(normId, { id: t.empleado_id, fechas: {} });
    byEmp.get(normId).fechas[normalizeDate(t.fecha)] = t.turno;
  }

  // Añadir empleados que solo aparecen en eventos (ausencias sin turno base esa semana)
  for (const ev of eventos) {
    if (normalizeEstado(ev.estado) === 'anulado') continue;
    const tipo = normalizeTipo(ev.tipo);
    if (!['VAC','BAJA','PERM','FORM'].includes(tipo)) continue;
    const evH = normalizeId(getEventoHotel(ev));
    const hN  = normalizeId(hotel);
    if (evH && hN && evH !== hN) continue;
    const eId = ev.empleado_id;
    if (!eId) continue;
    const normId = normalizeId(eId);
    if (!byEmp.has(normId)) byEmp.set(normId, { id: eId, fechas: {} });
  }

  const rows = [];
  for (const [normId, empData] of byEmp) {
    const profile = empleados.find(e =>
      normalizeId(e.id) === normId || normalizeId(e.nombre) === normId
    );
    const nombre = profile?.nombre || empData.id;

    // Excluir separadores y placeholders
    if (/^---/.test(empData.id) || empData.id === '¿?' || empData.id === '?') continue;

    const cells = {};
    for (const fecha of dates) {
      const turnoBase = empData.fechas[fecha] || null;
      const resolved  = resolveDay({ empleadoId: empData.id, hotel, fecha, turnoBase, eventos });
      const absCode   = getAbsCode(resolved.incidencia);
      cells[fecha] = {
        code:  absCode || resolved.turno || '',
        type:  resolved.incidencia || 'NORMAL',
        label: absCode
          ? { VAC:'Vacaciones', BAJA:'Baja', PERM:'Permiso', FORM:'Formación' }[absCode] || absCode
          : (resolved.turno || '—'),
        origen: resolved.origen
      };
    }

    rows.push({
      empleado_id:   empData.id,
      nombreVisible: nombre,
      cells
    });
  }

  return {
    hotel_id:    hotel,
    hotel_nombre: hotel,
    week_start:  dates[0],
    week_end:    dates[6],
    rows
  };
}

// ── VALIDADOR EVENTO→SNAPSHOT ─────────────────────────────────────────────────
function validateSnapshot(snap, eventos) {
  const errors   = [];
  const warnings = [];
  const wStart   = snap.week_start;
  const wEnd     = snap.week_end;
  const snapH    = normalizeId(snap.hotel_id);

  for (const ev of eventos) {
    if (normalizeEstado(ev.estado) === 'anulado') continue;
    const tipo = normalizeTipo(ev.tipo);
    if (!['VAC','BAJA','PERM','FORM'].includes(tipo)) continue;

    const evH = normalizeId(getEventoHotel(ev));
    if (evH && snapH && evH !== snapH) continue;

    const evStart = normalizeDate(ev.fecha_inicio);
    const evEnd   = normalizeDate(ev.fecha_fin || ev.fecha_inicio);
    if (!evStart || evStart > wEnd || evEnd < wStart) continue;

    const idNorm = normalizeId(ev.empleado_id);
    const row    = snap.rows.find(r => normalizeId(r.empleado_id) === idNorm);

    if (!row) {
      errors.push({
        type:  'MISSING_ROW',
        msg:   `[BLOQUEO] ${tipo} de "${ev.empleado_id}" no aparece en snapshot de ${snap.hotel_id}`,
        ev_id: ev.id, ev_tipo: tipo, empleado: ev.empleado_id
      });
      continue;
    }

    const cellDates = Object.keys(row.cells).filter(d =>
      d >= evStart && d <= evEnd && d >= wStart && d <= wEnd
    );

    for (const d of cellDates) {
      const cell = row.cells[d];
      if (!cell) {
        errors.push({
          type: 'MISSING_CELL', msg: `[BLOQUEO] Celda faltante ${row.nombreVisible} el ${d}`,
          ev_id: ev.id, ev_tipo: tipo, empleado: ev.empleado_id, fecha: d
        });
        continue;
      }
      const code = String(cell.code || '').toUpperCase();
      const type = String(cell.type || '').toUpperCase();
      const expected = { VAC:'VAC', BAJA:'BAJA', PERM:'PERM', FORM:'FORM' }[tipo];
      if (!(code === expected || type === expected)) {
        errors.push({
          type: 'WRONG_CODE',
          msg:  `[BLOQUEO] ${tipo} no renderizado para ${row.nombreVisible} el ${d} — code="${code}" type="${type}"`,
          ev_id: ev.id, ev_tipo: tipo, empleado: ev.empleado_id, fecha: d,
          got_code: code, got_type: type, expected
        });
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── DRY RUN PRINCIPAL ─────────────────────────────────────────────────────────
async function dryRunJunio() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  DRY RUN – JUNIO 2026 – EVENTO → SNAPSHOT (SOLO LECTURA)');
  console.log('══════════════════════════════════════════════════════════\n');
  console.log('⚠️  NO SE ESCRIBE NADA EN SUPABASE.\n');

  // ── 1. Cargar datos base ─────────────────────────────────────────────────
  console.log('→ Cargando empleados...');
  const empleados = await fetchEmpleados().catch(() => []);
  console.log(`  ${empleados.length} empleados cargados.`);

  console.log('→ Cargando eventos de Junio 2026...');
  const eventosJunio = await fetchEventos(JUNE_START, JUNE_END);
  console.log(`  ${eventosJunio.length} eventos cargados en bruto.`);

  // ── 2. Semanas de Junio ──────────────────────────────────────────────────
  const weeks = buildWeeksInRange(JUNE_START, JUNE_END);
  console.log(`\n→ Semanas de Junio 2026: ${weeks.length}`);
  weeks.forEach((w, i) => console.log(`   Semana ${i+1}: ${w.start} → ${w.end}`));

  // ── 3. Métricas globales ─────────────────────────────────────────────────
  const metrics = {
    semanasAnalizadas: 0, snapshotsSimulados: 0,
    vacEsperados: 0, vacRenderizados: 0,
    bajaEsperados: 0, bajaRenderizados: 0,
    permEsperados: 0, permRenderizados: 0,
    eventosPerdidos: 0,
    semanasBlockeadas: [], semanasAptas: [], semanasAvisos: []
  };

  const muestras = { VAC: null, BAJA: null, PERM: null, NORMAL: null, CT: null };
  const allErrors = [];

  // ── 4. Iterar semanas × hoteles ──────────────────────────────────────────
  for (const week of weeks) {
    metrics.semanasAnalizadas++;
    const dates  = [0,1,2,3,4,5,6].map(i => addDays(week.start, i));

    console.log(`\n── Semana ${week.start} → ${week.end} ──────────────────────────`);

    // Cargar turnos de la semana
    const turnosSemana = await fetchTurnos(week.start, week.end);
    console.log(`   Turnos base: ${turnosSemana.length} filas`);

    // Eventos que intersectan esta semana
    const eventosWeek = eventosJunio.filter(ev => {
      const fi = normalizeDate(ev.fecha_inicio);
      const ff = normalizeDate(ev.fecha_fin || ev.fecha_inicio);
      return fi <= week.end && ff >= week.start;
    });

    const absEventosWeek = eventosWeek.filter(ev => {
      const t = normalizeTipo(ev.tipo);
      return ['VAC','BAJA','PERM','FORM'].includes(t) &&
             normalizeEstado(ev.estado) !== 'anulado';
    });
    console.log(`   Eventos ausencia activos en semana: ${absEventosWeek.length}`);

    let semanaBlockeada = false;
    let semanaAvisos    = false;

    for (const hotel of HOTELS) {
      metrics.snapshotsSimulados++;

      // Contar eventos esperados por hotel
      const absH = absEventosWeek.filter(ev => {
        const evH = normalizeId(getEventoHotel(ev));
        const hN  = normalizeId(hotel);
        return !evH || !hN || evH === hN;
      });

      const vacExp  = absH.filter(ev => normalizeTipo(ev.tipo) === 'VAC').length;
      const bajaExp = absH.filter(ev => normalizeTipo(ev.tipo) === 'BAJA').length;
      const permExp = absH.filter(ev => normalizeTipo(ev.tipo) === 'PERM').length;

      metrics.vacEsperados  += vacExp;
      metrics.bajaEsperados += bajaExp;
      metrics.permEsperados += permExp;

      // Construir snapshot simulado
      const snap = buildSnapshotForHotel({
        hotel, dates,
        turnos:    turnosSemana,
        eventos:   eventosJunio,
        empleados
      });

      // Contar renderizados
      let vacRend = 0, bajaRend = 0, permRend = 0;
      for (const row of snap.rows) {
        for (const [, cell] of Object.entries(row.cells)) {
          const code = String(cell.code || '').toUpperCase();
          const type = String(cell.type || '').toUpperCase();
          if (code === 'VAC'  || type === 'VAC')  vacRend++;
          if (code === 'BAJA' || type === 'BAJA') bajaRend++;
          if (code === 'PERM' || type === 'PERM') permRend++;
        }
      }
      metrics.vacRenderizados  += vacRend;
      metrics.bajaRenderizados += bajaRend;
      metrics.permRenderizados += permRend;

      // Validar
      const val = validateSnapshot(snap, eventosJunio);

      if (!val.ok) {
        semanaBlockeada = true;
        val.errors.forEach(e => {
          allErrors.push({ semana: week.start, hotel, ...e });
          metrics.eventosPerdidos++;
        });
      }
      if (val.warnings.length > 0) semanaAvisos = true;

      // Recoger muestras
      for (const row of snap.rows) {
        for (const [fecha, cell] of Object.entries(row.cells)) {
          if (!muestras.VAC && cell.type === 'VAC') {
            muestras.VAC = { empleado: row.nombreVisible, hotel, semana: week.start, fecha, cell };
          }
          if (!muestras.BAJA && cell.type === 'BAJA') {
            muestras.BAJA = { empleado: row.nombreVisible, hotel, semana: week.start, fecha, cell };
          }
          if (!muestras.PERM && cell.type === 'PERM') {
            muestras.PERM = { empleado: row.nombreVisible, hotel, semana: week.start, fecha, cell };
          }
          if (!muestras.NORMAL && cell.type === 'NORMAL' && ['M','T','N'].includes(cell.code)) {
            muestras.NORMAL = { empleado: row.nombreVisible, hotel, semana: week.start, fecha, cell };
          }
        }
      }

      const hotelShort = hotel.includes('Cumbria') ? 'CUMBRIA' : 'GUADIANA';
      console.log(`   [${hotelShort}] Rows: ${snap.rows.length} | VAC: ${vacRend}/${vacExp} | BAJA: ${bajaRend}/${bajaExp} | PERM: ${permRend}/${permExp} | Errores: ${val.errors.length}`);
    }

    if (semanaBlockeada) {
      metrics.semanasBlockeadas.push(week.start);
    } else if (semanaAvisos) {
      metrics.semanasAvisos.push(week.start);
    } else {
      metrics.semanasAptas.push(week.start);
    }
  }

  // ── 5. INFORME FINAL ─────────────────────────────────────────────────────
  console.log('\n');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  RESULTADOS DRY RUN – JUNIO 2026');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n  Semanas analizadas      : ${metrics.semanasAnalizadas}`);
  console.log(`  Snapshots simulados     : ${metrics.snapshotsSimulados}`);
  console.log('');
  console.log(`  VAC  esperados          : ${metrics.vacEsperados}`);
  console.log(`  VAC  renderizados       : ${metrics.vacRenderizados}`);
  console.log(`  BAJA esperados          : ${metrics.bajaEsperados}`);
  console.log(`  BAJA renderizados       : ${metrics.bajaRenderizados}`);
  console.log(`  PERM esperados          : ${metrics.permEsperados}`);
  console.log(`  PERM renderizados       : ${metrics.permRenderizados}`);
  console.log('');
  console.log(`  Eventos perdidos        : ${metrics.eventosPerdidos}`);
  console.log('');
  console.log(`  Semanas APTAS           : ${metrics.semanasAptas.length} → ${metrics.semanasAptas.join(', ') || '—'}`);
  console.log(`  Semanas BLOQUEADAS      : ${metrics.semanasBlockeadas.length} → ${metrics.semanasBlockeadas.join(', ') || '—'}`);
  console.log(`  Semanas CON AVISOS      : ${metrics.semanasAvisos.length} → ${metrics.semanasAvisos.join(', ') || '—'}`);

  if (allErrors.length > 0) {
    console.log('\n── ERRORES BLOQUEANTES ──────────────────────────────────────');
    allErrors.forEach((e, i) => {
      console.log(`  [${i+1}] ${e.msg}`);
      console.log(`      Semana: ${e.semana} | Hotel: ${e.hotel}`);
    });
  }

  // ── 6. MUESTRAS ──────────────────────────────────────────────────────────
  console.log('\n── MUESTRAS JSON ────────────────────────────────────────────');
  ['VAC','BAJA','PERM','NORMAL'].forEach(t => {
    const m = muestras[t];
    if (m) {
      console.log(`\n  [${t}] ${m.empleado} | ${m.hotel} | Semana: ${m.semana} | Fecha: ${m.fecha}`);
      console.log('  cell =', JSON.stringify(m.cell, null, 2).replace(/\n/g, '\n  '));
    } else {
      console.log(`\n  [${t}] — No se encontraron casos en Junio 2026`);
    }
  });

  // ── 7. VEREDICTO ─────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  if (metrics.eventosPerdidos === 0) {
    console.log('  ✅ VEREDICTO: eventos perdidos = 0');
    console.log('  Junio 2026 PUEDE proponerse para publicación.');
    console.log('  → Solicitar autorización explícita para publicar Junio 2026.');
  } else {
    console.log(`  ❌ VEREDICTO: ${metrics.eventosPerdidos} eventos perdidos detectados.`);
    console.log('  Junio 2026 NO puede publicarse hasta resolver los errores.');
  }
  console.log('══════════════════════════════════════════════════════════\n');

  return metrics;
}

// ── ENTRY POINT ───────────────────────────────────────────────────────────────
dryRunJunio().catch(err => {
  console.error('\n[FATAL] Error en dry run:', err.message);
  console.error(err.stack);
  process.exit(1);
});
