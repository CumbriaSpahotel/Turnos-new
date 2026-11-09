const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function execute() {
  console.log("=== INICIANDO ACTUALIZACIÓN SEMANA 16/11/2026 A 22/11/2026 (SERCOTEL GUADIANA) ===");
  console.log("1. Elena coge los turnos de Natalio todos los días (L-V: Tarde, S-D: Descanso).");
  console.log("2. Marcos coge los turnos de Elena (L-M: Descanso, X-D: Noche).");
  console.log("3. Natalio queda sin asignación esa semana en Guadiana.");

  const DATES = [
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
    '2026-11-21',
    '2026-11-22'
  ];

  const elenaShifts = [
    { fecha: '2026-11-16', turno: 'T' },
    { fecha: '2026-11-17', turno: 'T' },
    { fecha: '2026-11-18', turno: 'T' },
    { fecha: '2026-11-19', turno: 'T' },
    { fecha: '2026-11-20', turno: 'T' },
    { fecha: '2026-11-21', turno: 'D' },
    { fecha: '2026-11-22', turno: 'D' }
  ];

  const marcosShifts = [
    { fecha: '2026-11-16', turno: 'D' },
    { fecha: '2026-11-17', turno: 'D' },
    { fecha: '2026-11-18', turno: 'N' },
    { fecha: '2026-11-19', turno: 'N' },
    { fecha: '2026-11-20', turno: 'N' },
    { fecha: '2026-11-21', turno: 'N' },
    { fecha: '2026-11-22', turno: 'N' }
  ];

  // 1. Actualizar turnos de Elena (EMP-0018) en tabla turnos
  console.log("\n--- Actualizando turnos de Elena en base de datos ---");
  for (const s of elenaShifts) {
    const res = await fetch(`${url}/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.EMP-0018&fecha=eq.${s.fecha}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({
        turno: s.turno,
        tipo: 'NORMAL',
        updated_at: new Date().toISOString(),
        updated_by: 'ADMIN_MANUAL_UPDATE'
      })
    });
    console.log(`Elena ${s.fecha} -> ${s.turno}: status ${res.status}`);
  }

  // 2. Insertar / Upsert turnos de Marcos (EMP-0020) en tabla turnos
  console.log("\n--- Upsert turnos de Marcos en base de datos ---");
  for (const s of marcosShifts) {
    // Intentar PATCH primero
    const patchRes = await fetch(`${url}/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.EMP-0020&fecha=eq.${s.fecha}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({
        turno: s.turno,
        tipo: 'NORMAL',
        updated_at: new Date().toISOString(),
        updated_by: 'ADMIN_MANUAL_UPDATE'
      })
    });
    const patchJson = await patchRes.json();
    if (!patchJson || patchJson.length === 0) {
      // Si no existe, insertar
      const insertRes = await fetch(`${url}/rest/v1/turnos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          hotel_id: 'Sercotel Guadiana',
          empleado_id: 'EMP-0020',
          empleado_uuid: '3a672975-6fa2-4c9e-ac96-6a7a5c7af697',
          fecha: s.fecha,
          turno: s.turno,
          tipo: 'NORMAL',
          updated_at: new Date().toISOString(),
          updated_by: 'ADMIN_MANUAL_UPDATE'
        })
      });
      console.log(`Marcos ${s.fecha} -> ${s.turno} (INSERT): status ${insertRes.status}`);
    } else {
      console.log(`Marcos ${s.fecha} -> ${s.turno} (PATCH): status ${patchRes.status}`);
    }
  }

  // 3. Eliminar turnos de Natalio para esa semana en Sercotel Guadiana
  console.log("\n--- Eliminando turnos de Natalio en Sercotel Guadiana ---");
  const delRes = await fetch(`${url}/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Natalio&fecha=gte.2026-11-16&fecha=lte.2026-11-22`, {
    method: 'DELETE',
    headers: HEADERS
  });
  console.log(`Eliminados turnos de Natalio: status ${delRes.status}`);

  // 4. Actualizar publicación activa en publicaciones_cuadrante
  console.log("\n--- Actualizando publicación activa ---");
  const pubRes = await fetch(`${url}/rest/v1/publicaciones_cuadrante?hotel=eq.Sercotel%20Guadiana&semana_inicio=eq.2026-11-16&order=version.desc&limit=1&select=*`, { headers: HEADERS });
  const [currentPub] = await pubRes.json();
  if (!currentPub) {
    throw new Error("No se encontró publicación previa para semana 2026-11-16.");
  }

  const nextVersion = (currentPub.version || 0) + 1;
  const snapJson = JSON.parse(JSON.stringify(currentPub.snapshot_json));
  let rows = snapJson.rows || snapJson.empleados || [];

  // Crear celda helper
  function buildCell(code, label, icon, isChanged, note) {
    return {
      code: code,
      type: "NORMAL",
      icons: icon ? [icon] : [],
      label: label,
      title: note || `Cambio de turno: ${label}`,
      origen: isChanged ? "CAMBIO_TURNO" : "BASE",
      changed: isChanged,
      horario: null,
      isAbsence: false,
      sustituto: null,
      isRefuerzo: false,
      titular_cubierto: null,
      incidenciaCubierta: null
    };
  }

  // Preparar celdas de Elena
  const elenaCells = {
    '2026-11-16': buildCell('T', 'Tarde', '🌅', true, 'Coge turno de Natalio: Tarde'),
    '2026-11-17': buildCell('T', 'Tarde', '🌅', true, 'Coge turno de Natalio: Tarde'),
    '2026-11-18': buildCell('T', 'Tarde', '🌅', true, 'Coge turno de Natalio: Tarde'),
    '2026-11-19': buildCell('T', 'Tarde', '🌅', true, 'Coge turno de Natalio: Tarde'),
    '2026-11-20': buildCell('T', 'Tarde', '🌅', true, 'Coge turno de Natalio: Tarde'),
    '2026-11-21': buildCell('D', 'Descanso', null, false, 'Descanso'),
    '2026-11-22': buildCell('D', 'Descanso', null, false, 'Descanso')
  };

  // Preparar celdas de Marcos
  const marcosCells = {
    '2026-11-16': buildCell('D', 'Descanso', null, false, 'Descanso'),
    '2026-11-17': buildCell('D', 'Descanso', null, false, 'Descanso'),
    '2026-11-18': buildCell('N', 'Noche', '🌙', true, 'Coge turno de Elena: Noche'),
    '2026-11-19': buildCell('N', 'Noche', '🌙', true, 'Coge turno de Elena: Noche'),
    '2026-11-20': buildCell('N', 'Noche', '🌙', true, 'Coge turno de Elena: Noche'),
    '2026-11-21': buildCell('N', 'Noche', '🌙', true, 'Coge turno de Elena: Noche'),
    '2026-11-22': buildCell('N', 'Noche', '🌙', true, 'Coge turno de Elena: Noche')
  };

  const marcosRow = {
    orden: 4,
    nombre: "Marcos",
    puesto: "Recepción Noches",
    rowType: "operativo",
    evento_id: null,
    empleado_id: "EMP-0020",
    origenOrden: null,
    puestoOrden: 4,
    nombreVisible: "Marcos",
    tipo_personal: "fijo",
    excludeCounters: false,
    cells: marcosCells,
    dias: marcosCells
  };

  // Actualizar filas: reemplazar Natalio con Marcos, o quitar Natalio y añadir Marcos
  let marcosInserted = false;
  const newRows = [];
  for (const r of rows) {
    const name = String(r.nombreVisible || r.nombre || '').trim().toLowerCase();
    const id = String(r.empleado_id || '').trim().toLowerCase();

    if (name.includes('natalio') || id.includes('natalio')) {
      // Natalio queda sin asignación en Guadiana esa semana; reemplazado operativamente
      continue;
    }

    if (name.includes('marcos') || id === 'emp-0020') {
      // Si ya estaba de una corrida previa, no duplicar
      continue;
    }

    if (name.includes('elena') || id === 'emp-0018') {
      r.cells = elenaCells;
      r.dias = elenaCells;
      newRows.push(r);
      // Añadir Marcos a continuación de Elena
      newRows.push(marcosRow);
      marcosInserted = true;
      continue;
    }

    newRows.push(r);
  }

  if (!marcosInserted) {
    newRows.push(marcosRow);
  }

  snapJson.rows = newRows;
  if (snapJson.empleados) snapJson.empleados = newRows;

  snapJson.metadata = {
    ...(snapJson.metadata || {}),
    rollback_target: currentPub.id,
    published_at: new Date().toISOString(),
    manual_adjustment: 'Elena coge turnos Natalio (L-V Tarde, S-D Descanso); Marcos coge turnos Elena (L-M Descanso, X-D Noche)'
  };

  const newPubPayload = {
    semana_inicio: '2026-11-16',
    semana_fin: '2026-11-22',
    hotel: 'Sercotel Guadiana',
    snapshot_json: snapJson,
    resumen: currentPub.resumen || { emps: newRows.length },
    publicado_por: 'ADMIN',
    version: nextVersion,
    estado: 'activo',
    fecha_publicacion: new Date().toISOString()
  };

  const insertPubRes = await fetch(`${url}/rest/v1/publicaciones_cuadrante`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(newPubPayload)
  });
  console.log(`Publicación v${nextVersion} insertada: status ${insertPubRes.status}`);

  // Llamar RPC cleanup_publicacion_activa
  const cleanupRes = await fetch(`${url}/rest/v1/rpc/cleanup_publicacion_activa`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      p_hotel: 'Sercotel Guadiana',
      p_semana_inicio: '2026-11-16'
    })
  });
  console.log(`Cleanup RPC status: ${cleanupRes.status}`);

  // Verificación final
  console.log("\n=== VERIFICACIÓN POST-ACTUALIZACIÓN ===");
  const checkRes = await fetch(`${url}/rest/v1/publicaciones_cuadrante?hotel=eq.Sercotel%20Guadiana&semana_inicio=eq.2026-11-16&estado=eq.activo&order=version.desc&limit=1&select=*`, { headers: HEADERS });
  const [activeCheck] = await checkRes.json();
  console.log(`Publicación activa final: v${activeCheck.version}`);
  const finalRows = activeCheck.snapshot_json?.rows || [];
  for (const r of finalRows) {
    const summary = DATES.map(d => `${d.slice(5)}:${r.cells?.[d]?.code || '?'}`).join(' ');
    console.log(`- ${r.nombreVisible || r.nombre} (${r.empleado_id}): ${summary}`);
  }

  // Comprobar cobertura diaria
  console.log("\n=== COBERTURA DIARIA (Sercotel Guadiana 16/11 - 22/11) ===");
  for (const d of DATES) {
    const coverage = finalRows
      .filter(r => r.cells?.[d] && r.cells[d].code !== '—' && r.cells[d].code !== 'D' && r.cells[d].code !== 'VAC')
      .map(r => `${r.nombreVisible || r.nombre} (${r.cells[d].code})`);
    console.log(`${d}: ${coverage.join(', ')}`);
  }
}

execute().catch(console.error);
