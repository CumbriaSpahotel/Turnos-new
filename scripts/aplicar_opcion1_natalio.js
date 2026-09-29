/**
 * scripts/aplicar_opcion1_natalio.js
 * 
 * Aplica la Opción 1:
 * 1. Divide las vacaciones de Cristina:
 *    - Semana 1 (28/09/2026 - 04/10/2026): Cristina VAC sin sustituto (cobertura interna).
 *    - Semana 2 (05/10/2026 - 11/10/2026): Cristina VAC con sustituto Natalio.
 * 2. Elimina los turnos huérfanos de EMP-0019 (Pendiente) en Sercotel Guadiana (01/10 y 02/10).
 * 3. Actualiza las publicaciones activas en publicaciones_cuadrante:
 *    - Cumbria Spa&Hotel: Natalio solo el Lunes 28 con T; Cristina VAC sin sustituto esta semana.
 *    - Sercotel Guadiana: Natalio Lunes libre/Cumbria, Martes N, Miércoles N, Jueves D, Viernes D, Sábado T, Domingo T.
 *      Sin fila de Pendiente.
 */

const fs = require('fs');
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
    rowType: rowType,
    tipo_personal: extraProps.tipo_personal || 'fijo',
    excludeCounters: extraProps.excludeCounters || false,
    titularOriginalId: extraProps.titularOriginalId || null,
    puesto: extraProps.puesto || 'Recepcionista',
    dias,
    cells
  };
}

async function main() {
  console.log('=== APLICANDO OPCIÓN 1 (NATALIO Y VACACIONES CRISTINA) ===\n');

  // 1. Modificar evento de vacaciones de Cristina semana 1 (28/09 - 04/10) sin sustituto
  console.log('1. Ajustando evento de vacaciones de Cristina...');
  const evtId = '795651fb-a0c5-4b27-9a0b-644c10174d1b';
  const patchEvtRes = await fetch(`${url}/rest/v1/eventos_cuadrante?id=eq.${evtId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fecha_inicio: '2026-09-28',
      fecha_fin: '2026-10-04',
      empleado_destino_id: null,
      observaciones: 'Semana 1 vacaciones Cristina (cobertura interna plantilla)',
      payload: { tipo_modulo: 'vacaciones', cobertura: 'interna' },
      updated_at: new Date().toISOString(),
      updated_by: 'WEB_ADMIN'
    })
  });

  if (!patchEvtRes.ok) {
    throw new Error(`Error modificando evento Cristina sem 1: ${patchEvtRes.status} ${await patchEvtRes.text()}`);
  }
  console.log(' -> Evento semana 1 ajustado: Cristina del 28/09 al 04/10 sin sustituto.');

  // 2. Crear evento para la semana 2 (05/10 - 11/10) con sustituto Natalio
  const newEvtPayload = {
    tipo: 'VAC',
    estado: 'activo',
    empleado_id: 'Cristina',
    empleado_destino_id: 'Natalio',
    hotel_origen: 'Cumbria Spa&Hotel',
    fecha_inicio: '2026-10-05',
    fecha_fin: '2026-10-11',
    observaciones: 'Semana 2 vacaciones Cristina (sustituto: Natalio)',
    payload: { tipo_modulo: 'vacaciones' },
    updated_by: 'WEB_ADMIN'
  };

  const insertEvtRes = await fetch(`${url}/rest/v1/eventos_cuadrante`, {
    method: 'POST',
    headers,
    body: JSON.stringify([newEvtPayload])
  });

  if (!insertEvtRes.ok) {
    throw new Error(`Error creando evento Cristina sem 2: ${insertEvtRes.status} ${await insertEvtRes.text()}`);
  }
  const [createdEvt] = await insertEvtRes.json();
  console.log(` -> Evento semana 2 creado (ID: ${createdEvt.id}): Cristina del 05/10 al 11/10 sustituida por Natalio.`);

  // 3. Eliminar turnos residuales de EMP-0019 (Pendiente) en Guadiana
  console.log('\n2. Limpiando turnos residuales de Pendiente (EMP-0019) en Guadiana...');
  const delRes = await fetch(`${url}/rest/v1/turnos?empleado_id=eq.EMP-0019&fecha=gte.2026-09-28&fecha=lte.2026-10-04`, {
    method: 'DELETE',
    headers
  });
  console.log(` -> Filas residuales de EMP-0019 eliminadas (status: ${delRes.status}).`);

  // 4. Asegurar turnos correctos en tabla `turnos`
  console.log('\n3. Verificando turnos en tabla turnos...');
  // Natalio en Cumbria solo el lunes 28 T:
  // Natalio en Guadiana de martes a domingo:
  const turnosNatalio = [
    { empleado_id: 'Natalio', fecha: '2026-09-28', hotel_id: 'Cumbria Spa&Hotel', turno: 'T', tipo: 'NORMAL', updated_by: 'OPCION_1' },
    { empleado_id: 'Natalio', fecha: '2026-09-29', hotel_id: 'Sercotel Guadiana', turno: 'N', tipo: 'NORMAL', updated_by: 'OPCION_1' },
    { empleado_id: 'Natalio', fecha: '2026-09-30', hotel_id: 'Sercotel Guadiana', turno: 'N', tipo: 'NORMAL', updated_by: 'OPCION_1' },
    { empleado_id: 'Natalio', fecha: '2026-10-01', hotel_id: 'Sercotel Guadiana', turno: 'D', tipo: 'NORMAL', updated_by: 'OPCION_1' },
    { empleado_id: 'Natalio', fecha: '2026-10-02', hotel_id: 'Sercotel Guadiana', turno: 'D', tipo: 'NORMAL', updated_by: 'OPCION_1' },
    { empleado_id: 'Natalio', fecha: '2026-10-03', hotel_id: 'Sercotel Guadiana', turno: 'T', tipo: 'NORMAL', updated_by: 'OPCION_1' },
    { empleado_id: 'Natalio', fecha: '2026-10-04', hotel_id: 'Sercotel Guadiana', turno: 'T', tipo: 'NORMAL', updated_by: 'OPCION_1' }
  ];
  await fetch(`${url}/rest/v1/turnos?on_conflict=empleado_id,fecha`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(turnosNatalio)
  });
  console.log(' -> Turnos de Natalio sincronizados.');

  // 5. Publicar nuevos snapshots limpios en publicaciones_cuadrante
  console.log('\n4. Generando snapshots actualizados en publicaciones_cuadrante...');

  // Sercotel Guadiana Rows (SIN PENDIENTE, NATALIO CORRECTO)
  const guadianaRows = [
    buildRow('EMP-0018', 'Elena', 'operativo', ['D', 'D', 'M', 'M', 'M', 'M', 'M'], { puesto: 'Recepcionista', titularOriginalId: 'Diana' }),
    buildRow('Macarena', 'Macarena', 'operativo', ['T', 'T', 'T', 'T', 'T', 'D', 'D'], { puesto: 'Recepcionista' }),
    buildRow('Natalio', 'Natalio', 'operativo', ['—', 'N', 'N', 'D', 'D', 'T', 'T'], { puesto: 'Recepcionista' }),
    buildRow('Dani', 'Dani', 'operativo', ['N', 'D', 'D', 'N', 'N', 'N', 'N'], { puesto: 'Recepcionista', titularOriginalId: 'Federico' }),
    buildRow('Sergio Sánchez', 'S. Sánchez', 'operativo', ['M', 'M', '—', '—', '—', '—', '—'], { puesto: 'Apoyo Recepción', excludeCounters: true }),
    buildRow('Diana', 'Diana', 'ausencia_informativa', ['VAC', 'VAC', 'VAC', 'VAC', 'VAC', 'VAC', 'VAC'], { puesto: 'Recepcionista', titularOriginalId: 'Diana' }),
    buildRow('Federico', 'Federico', 'ausencia_informativa', ['BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA'], { puesto: 'Recepcionista', titularOriginalId: 'Federico' })
  ];

  // Cumbria Spa&Hotel Rows (NATALIO SOLO LUNES, SIN DUPLICAR CON ESTHER)
  const cumbriaRows = [
    buildRow('Gustavo Sánchez', 'Gustavo Sánchez', 'operativo', ['D', 'D', 'M', 'M', 'M', 'M', 'D'], { puesto: 'Recepcionista' }),
    buildRow('Esther', 'Esther', 'operativo', ['D', 'T', 'T', 'T', 'T', 'D', 'M'], { puesto: 'Recepcionista' }),
    buildRow('Miriam', 'Miriam', 'operativo', ['M', 'N', 'N', 'D', 'D', 'T', 'T'], { puesto: 'Recepcionista', titularOriginalId: 'Sergio' }),
    buildRow('Valentín', 'Valentín', 'operativo', ['N', 'D', 'D', 'N', 'N', 'N', 'N'], { puesto: 'Recepcionista' }),
    buildRow('Isabel Hidalgo', 'Isabel Hidalgo', 'operativo', ['—', 'M', '—', '—', '—', '—', '—'], { puesto: 'Apoyo Recepción', excludeCounters: true }),
    buildRow('Natalio', 'Natalio', 'operativo', ['T', '—', '—', '—', '—', '—', '—'], { puesto: 'Apoyo Recepción', excludeCounters: true }),
    buildRow('Sergio', 'Sergio', 'ausencia_informativa', ['BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA'], { puesto: 'Recepcionista', titularOriginalId: 'Sergio' }),
    buildRow('Cristina', 'Cristina', 'ausencia_informativa', ['VAC', 'VAC', 'VAC', 'VAC', 'VAC', 'VAC', 'VAC'], { puesto: 'Recepcionista', titularOriginalId: 'Cristina' })
  ];

  const snapG = {
    semana_inicio: '2026-09-28',
    semana_fin: '2026-10-04',
    hotel: 'Sercotel Guadiana',
    version: 154,
    estado: 'activo',
    publicado_por: 'ADMIN',
    fecha_publicacion: new Date().toISOString(),
    snapshot_json: {
      week_start: '2026-09-28',
      week_end: '2026-10-04',
      hotel_id: 'Sercotel Guadiana',
      hotel_nombre: 'Sercotel Guadiana',
      version: 154,
      metadata: {
        published_at: new Date().toISOString(),
        note: 'Semana especial adaptada (Opción 1: división vacaciones Cristina)'
      },
      rows: guadianaRows
    }
  };

  const snapC = {
    semana_inicio: '2026-09-28',
    semana_fin: '2026-10-04',
    hotel: 'Cumbria Spa&Hotel',
    version: 149,
    estado: 'activo',
    publicado_por: 'ADMIN',
    fecha_publicacion: new Date().toISOString(),
    snapshot_json: {
      week_start: '2026-09-28',
      week_end: '2026-10-04',
      hotel_id: 'Cumbria Spa&Hotel',
      hotel_nombre: 'Cumbria Spa&Hotel',
      version: 149,
      metadata: {
        published_at: new Date().toISOString(),
        note: 'Semana especial adaptada (Opción 1: división vacaciones Cristina)'
      },
      rows: cumbriaRows
    }
  };

  const pubInsertRes = await fetch(`${url}/rest/v1/publicaciones_cuadrante`, {
    method: 'POST',
    headers,
    body: JSON.stringify([snapG, snapC])
  });

  if (!pubInsertRes.ok) {
    throw new Error(`Error guardando snapshots: ${pubInsertRes.status} ${await pubInsertRes.text()}`);
  }

  console.log(' -> Snapshots publicados con éxito:');
  console.log('    - Sercotel Guadiana (v154)');
  console.log('    - Cumbria Spa&Hotel (v149)');

  console.log('\n=== OPCIÓN 1 APLICADA CON ÉXITO ===');
}

main().catch(err => {
  console.error('\n[ERROR]', err);
  process.exit(1);
});
