/**
 * scripts/aplicar_semana_28sep_04oct.js
 * 
 * Vuelca exactamente el cuadrante manuscrito de la semana 28/09/2026 - 04/10/2026
 * en Supabase (tabla 'turnos' y tabla 'publicaciones_cuadrante').
 * 
 * Genera copias de seguridad previas en scratch/.
 */

const fs = require('fs');
const path = require('path');

const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const headers = {
  'apikey': key,
  'Authorization': 'Bearer ' + key,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const DATES = [
  '2026-09-28', // Lunes
  '2026-09-29', // Martes
  '2026-09-30', // Miércoles
  '2026-10-01', // Jueves
  '2026-10-02', // Viernes
  '2026-10-03', // Sábado
  '2026-10-04'  // Domingo
];

function buildCellData(code, extra = {}) {
  const c = String(code || '').trim().toUpperCase();
  if (!c || c === '—' || c === '-' || c === 'PENDIENTE') {
    return {
      code: '—',
      label: '—',
      type: 'NORMAL',
      icons: [],
      title: 'Sin turno asignado',
      changed: false,
      isAbsence: false,
      ...extra
    };
  }
  if (c === 'M') {
    return {
      code: 'M',
      label: 'Mañana',
      type: 'NORMAL',
      icons: ['☀️'],
      title: 'Mañana',
      changed: false,
      isAbsence: false,
      ...extra
    };
  }
  if (c === 'T') {
    return {
      code: 'T',
      label: 'Tarde',
      type: 'NORMAL',
      icons: [],
      title: 'Tarde',
      changed: false,
      isAbsence: false,
      ...extra
    };
  }
  if (c === 'N') {
    return {
      code: 'N',
      label: 'Noche',
      type: 'NORMAL',
      icons: ['🌙'],
      title: 'Noche',
      changed: false,
      isAbsence: false,
      ...extra
    };
  }
  if (c === 'D' || c === 'X') {
    return {
      code: 'D',
      label: 'Descanso',
      type: 'NORMAL',
      icons: [],
      title: c === 'X' ? 'Descanso / Fiesta' : 'Descanso',
      changed: false,
      isAbsence: false,
      ...extra
    };
  }
  if (c === 'VAC') {
    return {
      code: 'VAC',
      label: 'Vacaciones',
      type: 'VAC',
      icons: ['🌴'],
      title: 'Vacaciones',
      changed: false,
      isAbsence: true,
      ...extra
    };
  }
  if (c === 'BAJA' || c === 'B') {
    return {
      code: 'BAJA',
      label: 'Baja IT',
      type: 'BAJA',
      icons: ['🩹'],
      title: 'Baja médica',
      changed: false,
      isAbsence: true,
      ...extra
    };
  }
  return {
    code: c,
    label: c,
    type: 'NORMAL',
    icons: [],
    title: c,
    changed: false,
    isAbsence: false,
    ...extra
  };
}

function buildRow(empId, nombreVisible, rowType, shiftArray, extraProps = {}) {
  const dias = {};
  const cells = {};
  DATES.forEach((d, idx) => {
    const code = shiftArray[idx];
    const cell = buildCellData(code);
    dias[d] = cell;
    cells[d] = cell;
  });
  return {
    empleado_id: empId,
    nombre: nombreVisible,
    nombreVisible: nombreVisible,
    rowType: rowType, // 'operativo', 'ausencia_informativa'
    tipo_personal: extraProps.tipo_personal || 'fijo',
    excludeCounters: extraProps.excludeCounters || false,
    titularOriginalId: extraProps.titularOriginalId || null,
    puesto: extraProps.puesto || 'Recepcionista',
    dias,
    cells
  };
}

async function main() {
  console.log('=== INICIANDO VOLCADO SEMANA 28/09/2026 - 04/10/2026 ===\n');

  // 1. Obtener publicaciones y turnos actuales para backup
  const pubRes = await fetch(`${url}/rest/v1/publicaciones_cuadrante?semana_inicio=eq.2026-09-28&estado=eq.activo`, { headers });
  const currentPubs = await pubRes.json();
  
  const turnosRes = await fetch(`${url}/rest/v1/turnos?fecha=gte.2026-09-28&fecha=lte.2026-10-04`, { headers });
  const currentTurnos = await turnosRes.json();

  const backupDir = path.resolve(__dirname, '..', 'scratch');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(backupDir, `backup_pubs_2026-09-28_${ts}.json`), JSON.stringify(currentPubs, null, 2));
  fs.writeFileSync(path.join(backupDir, `backup_turnos_2026-09-28_${ts}.json`), JSON.stringify(currentTurnos, null, 2));
  console.log(`[Backup] Guardado respaldo de ${currentPubs.length} publicaciones y ${currentTurnos.length} turnos.`);

  // 2. Preparar registros para la tabla `turnos`
  const turnosToUpsert = [];

  // Sercotel Guadiana
  const gElena = ['D', 'D', 'M', 'M', 'M', 'M', 'M'];
  const gMacarena = ['T', 'T', 'T', 'T', 'T', 'D', 'D'];
  const gDani = ['N', 'D', 'D', 'N', 'N', 'N', 'N'];
  const gSergio = ['M', 'M', null, null, null, null, null];
  const gNatalio = [null, 'N', 'N', 'D', 'D', 'T', 'T'];

  DATES.forEach((d, i) => {
    if (gElena[i]) turnosToUpsert.push({ empleado_id: 'EMP-0018', fecha: d, hotel_id: 'Sercotel Guadiana', turno: gElena[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (gMacarena[i]) turnosToUpsert.push({ empleado_id: 'Macarena', fecha: d, hotel_id: 'Sercotel Guadiana', turno: gMacarena[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (gDani[i]) turnosToUpsert.push({ empleado_id: 'Dani', fecha: d, hotel_id: 'Sercotel Guadiana', turno: gDani[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (gSergio[i]) turnosToUpsert.push({ empleado_id: 'Sergio Sánchez', fecha: d, hotel_id: 'Sercotel Guadiana', turno: gSergio[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (gNatalio[i]) turnosToUpsert.push({ empleado_id: 'Natalio', fecha: d, hotel_id: 'Sercotel Guadiana', turno: gNatalio[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
  });

  // Cumbria Spa&Hotel
  const cGustavo = ['D', 'D', 'M', 'M', 'M', 'M', 'D'];
  const cMiriam = ['M', 'N', 'N', 'D', 'D', 'T', 'T'];
  const cEsther = ['D', 'T', 'T', 'T', 'T', 'D', 'M'];
  const cValentin = ['N', 'D', 'D', 'N', 'N', 'N', 'N'];
  const cIsabel = [null, 'M', null, null, null, null, null];
  const cNatalio = ['T', null, null, null, null, null, null];

  DATES.forEach((d, i) => {
    if (cGustavo[i]) turnosToUpsert.push({ empleado_id: 'Gustavo Sánchez', fecha: d, hotel_id: 'Cumbria Spa&Hotel', turno: cGustavo[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (cMiriam[i]) turnosToUpsert.push({ empleado_id: 'Miriam', fecha: d, hotel_id: 'Cumbria Spa&Hotel', turno: cMiriam[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (cEsther[i]) turnosToUpsert.push({ empleado_id: 'Esther', fecha: d, hotel_id: 'Cumbria Spa&Hotel', turno: cEsther[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (cValentin[i]) turnosToUpsert.push({ empleado_id: 'Valentín', fecha: d, hotel_id: 'Cumbria Spa&Hotel', turno: cValentin[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (cIsabel[i]) turnosToUpsert.push({ empleado_id: 'Isabel Hidalgo', fecha: d, hotel_id: 'Cumbria Spa&Hotel', turno: cIsabel[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
    if (cNatalio[i]) turnosToUpsert.push({ empleado_id: 'Natalio', fecha: d, hotel_id: 'Cumbria Spa&Hotel', turno: cNatalio[i], tipo: 'NORMAL', updated_by: 'SCRIPT_SEMANA_ESPECIAL' });
  });

  console.log(`[Turnos] Preparados ${turnosToUpsert.length} registros para upsert en tabla 'turnos'.`);

  // Ejecutar upsert en turnos
  const upsertTurnosRes = await fetch(`${url}/rest/v1/turnos?on_conflict=empleado_id,fecha`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(turnosToUpsert)
  });

  if (!upsertTurnosRes.ok) {
    const errText = await upsertTurnosRes.text();
    throw new Error(`Error en upsert de turnos: ${upsertTurnosRes.status} ${errText}`);
  }
  console.log('[Turnos] Upsert en tabla turnos realizado con éxito.');

  // 3. Preparar Snapshots para publicaciones_cuadrante

  // Sercotel Guadiana Rows
  const guadianaRows = [
    buildRow('EMP-0018', 'Elena', 'operativo', gElena, { puesto: 'Recepcionista', titularOriginalId: 'Diana' }),
    buildRow('Macarena', 'Macarena', 'operativo', gMacarena, { puesto: 'Recepcionista' }),
    buildRow('Natalio', 'Natalio', 'operativo', ['—', 'N', 'N', 'D', 'D', 'T', 'T'], { puesto: 'Recepcionista' }),
    buildRow('Dani', 'Dani', 'operativo', gDani, { puesto: 'Recepcionista', titularOriginalId: 'Federico' }),
    buildRow('Sergio Sánchez', 'S. Sánchez', 'operativo', ['M', 'M', '—', '—', '—', '—', '—'], { puesto: 'Apoyo Recepción', excludeCounters: true }),
    buildRow('Diana', 'Diana', 'ausencia_informativa', ['VAC', 'VAC', 'VAC', 'VAC', 'VAC', 'VAC', 'VAC'], { puesto: 'Recepcionista', titularOriginalId: 'Diana' }),
    buildRow('Federico', 'Federico', 'ausencia_informativa', ['BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA'], { puesto: 'Recepcionista', titularOriginalId: 'Federico' })
  ];

  // Cumbria Spa&Hotel Rows
  const cumbriaRows = [
    buildRow('Gustavo Sánchez', 'Gustavo Sánchez', 'operativo', cGustavo, { puesto: 'Recepcionista' }),
    buildRow('Esther', 'Esther', 'operativo', cEsther, { puesto: 'Recepcionista' }),
    buildRow('Miriam', 'Miriam', 'operativo', cMiriam, { puesto: 'Recepcionista', titularOriginalId: 'Sergio' }),
    buildRow('Valentín', 'Valentín', 'operativo', cValentin, { puesto: 'Recepcionista' }),
    buildRow('Isabel Hidalgo', 'Isabel Hidalgo', 'operativo', ['—', 'M', '—', '—', '—', '—', '—'], { puesto: 'Apoyo Recepción', excludeCounters: true }),
    buildRow('Natalio', 'Natalio', 'operativo', ['T', '—', '—', '—', '—', '—', '—'], { puesto: 'Apoyo Recepción', excludeCounters: true }),
    buildRow('Sergio', 'Sergio', 'ausencia_informativa', ['BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA'], { puesto: 'Recepcionista', titularOriginalId: 'Sergio' }),
    buildRow('Cristina', 'Cristina', 'ausencia_informativa', ['VAC', 'VAC', 'VAC', 'VAC', 'VAC', 'VAC', 'VAC'], { puesto: 'Recepcionista', titularOriginalId: 'Cristina' })
  ];

  // Desactivar snapshots anteriores activos de esta semana
  await fetch(`${url}/rest/v1/publicaciones_cuadrante?semana_inicio=eq.2026-09-28`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ estado: 'historico' })
  });
  console.log('[Publicaciones] Versiones anteriores marcadas como historico.');

  // Obtener versiones máximas
  const curG = currentPubs.find(p => p.hotel === 'Sercotel Guadiana');
  const curC = currentPubs.find(p => p.hotel === 'Cumbria Spa&Hotel');
  const nextVerG = (curG ? curG.version : 152) + 1;
  const nextVerC = (curC ? curC.version : 147) + 1;

  // Insertar nueva publicación de Sercotel Guadiana
  const snapGPayload = {
    semana_inicio: '2026-09-28',
    semana_fin: '2026-10-04',
    hotel: 'Sercotel Guadiana',
    version: nextVerG,
    estado: 'activo',
    publicado_por: 'ADMIN',
    fecha_publicacion: new Date().toISOString(),
    snapshot_json: {
      week_start: '2026-09-28',
      week_end: '2026-10-04',
      hotel_id: 'Sercotel Guadiana',
      hotel_nombre: 'Sercotel Guadiana',
      version: nextVerG,
      metadata: {
        published_at: new Date().toISOString(),
        note: 'Cuadrante manual semana especial según imagen física'
      },
      rows: guadianaRows
    }
  };

  const snapCPayload = {
    semana_inicio: '2026-09-28',
    semana_fin: '2026-10-04',
    hotel: 'Cumbria Spa&Hotel',
    version: nextVerC,
    estado: 'activo',
    publicado_por: 'ADMIN',
    fecha_publicacion: new Date().toISOString(),
    snapshot_json: {
      week_start: '2026-09-28',
      week_end: '2026-10-04',
      hotel_id: 'Cumbria Spa&Hotel',
      hotel_nombre: 'Cumbria Spa&Hotel',
      version: nextVerC,
      metadata: {
        published_at: new Date().toISOString(),
        note: 'Cuadrante manual semana especial según imagen física'
      },
      rows: cumbriaRows
    }
  };

  const insertPubsRes = await fetch(`${url}/rest/v1/publicaciones_cuadrante`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify([snapGPayload, snapCPayload])
  });

  if (!insertPubsRes.ok) {
    const errText = await insertPubsRes.text();
    throw new Error(`Error insertando publicaciones: ${insertPubsRes.status} ${errText}`);
  }

  const inserted = await insertPubsRes.json();
  console.log(`[Publicaciones] Nuevas publicaciones activas creadas con éxito:`);
  inserted.forEach(p => console.log(` - ${p.hotel} (v${p.version})`));

  console.log('\n=== SEMANA ESPECIAL APLICADA CON ÉXITO ===');
}

main().catch(err => {
  console.error('\n[ERROR]', err);
  process.exit(1);
});
