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
  console.log("=== ASIGNACIÓN DEFINITIVA VACANTE GUADIANA -> MARCOS (A PARTIR DE 23/11/2026) ===");

  // 1. Verificar y asegurar que en turnos ya no quede vacante-guadiana-1 desde 2026-11-23
  console.log("\n1. Verificando tabla turnos...");
  const resTurnos = await fetch(`${url}/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.vacante-guadiana-1&fecha=gte.2026-11-23`, {
    method: 'PATCH',
    headers: {
      ...HEADERS,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      empleado_id: 'EMP-0020',
      empleado_uuid: '3a672975-6fa2-4c9e-ac96-6a7a5c7af697',
      updated_at: new Date().toISOString(),
      updated_by: 'ADMIN_ASSIGN_VACANCY_MARCOS'
    })
  });
  console.log("Turnos patch status:", resTurnos.status);

  // 2. Actualizar publicaciones_cuadrante existentes desde 2026-11-23
  console.log("\n2. Actualizando snapshots en publicaciones_cuadrante...");
  const pubRes = await fetch(`${url}/rest/v1/publicaciones_cuadrante?hotel=eq.Sercotel%20Guadiana&semana_inicio=gte.2026-11-23&select=id,semana_inicio,version,snapshot_json`, { headers: HEADERS });
  const pubs = await pubRes.json();
  const pubsWithVac = pubs.filter(p => {
    const rows = p.snapshot_json?.rows || [];
    return rows.some(r => (r.empleado_id || '').toLowerCase().includes('vacante') || (r.nombre || '').toLowerCase().includes('vacante'));
  });

  console.log(`Encontradas ${pubsWithVac.length} publicaciones a actualizar.`);
  for (const pub of pubsWithVac) {
    const snap = JSON.parse(JSON.stringify(pub.snapshot_json));
    const rows = snap.rows || [];
    for (const r of rows) {
      if ((r.empleado_id || '').toLowerCase().includes('vacante') || (r.nombre || '').toLowerCase().includes('vacante')) {
        r.empleado_id = 'EMP-0020';
        r.nombre = 'Marcos';
        r.nombreVisible = 'Marcos';
        r.puesto = 'Recepción Noches';
        r.tipo_personal = 'fijo';
        // Mantener turnos en cells y dias
        for (const f of Object.keys(r.cells || {})) {
          if (r.cells[f].code === 'N') {
            r.cells[f].label = 'Noche';
            r.cells[f].icons = ['🌙'];
          }
        }
        for (const f of Object.keys(r.dias || {})) {
          if (r.dias[f].code === 'N') {
            r.dias[f].label = 'Noche';
            r.dias[f].icons = ['🌙'];
          }
        }
      }
    }
    snap.rows = rows;
    if (snap.empleados) snap.empleados = rows;

    const patchPub = await fetch(`${url}/rest/v1/publicaciones_cuadrante?id=eq.${pub.id}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({
        snapshot_json: snap,
        updated_at: new Date().toISOString()
      })
    });
    console.log(`- Semana ${pub.semana_inicio} (v${pub.version}): PATCH status ${patchPub.status}`);
  }

  // 3. Actualizar data/v9_excel_order_map.json y data/v9_excel_order_map.js
  console.log("\n3. Actualizando data/v9_excel_order_map...");
  const mapPath = 'data/v9_excel_order_map.json';
  const jsPath = 'data/v9_excel_order_map.js';
  const orderMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

  let countMap = 0;
  for (const entry of orderMap) {
    if (entry.week_start >= '2026-11-23' && entry.hotel === 'Sercotel Guadiana' && (entry.empleado_id === 'vacante-guadiana-1' || entry.display_name === 'SIN NOMBRE')) {
      entry.empleado_id = 'EMP-0020';
      entry.empleado_nombre = 'Marcos';
      entry.display_name = 'Marcos';
      countMap++;
    }
  }
  console.log(`Actualizadas ${countMap} entradas en order map.`);
  fs.writeFileSync(mapPath, JSON.stringify(orderMap, null, 2), 'utf8');

  const jsContent = '\uFEFF// v9_excel_order_map.js - Auto-generado. Vacante Guadiana -> Marcos desde 2026-11-23\n' +
    'window._v9_excel_order_data = ' + JSON.stringify(orderMap) + ';\n';
  fs.writeFileSync(jsPath, jsContent, 'utf8');
  console.log("Archivos v9_excel_order_map guardados.");

  // 4. Verificación de la semana 2026-11-23
  console.log("\n=== VERIFICACIÓN SEMANA 23/11/2026 ===");
  const checkWeek = await fetch(`${url}/rest/v1/publicaciones_cuadrante?hotel=eq.Sercotel%20Guadiana&semana_inicio=eq.2026-11-23&order=version.desc&limit=1&select=*`, { headers: HEADERS });
  const [activePub23] = await checkWeek.json();
  const rows23 = activePub23.snapshot_json?.rows || [];
  const dates23 = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];
  for (const r of rows23) {
    const summary = dates23.map(d => `${d.slice(5)}:${r.cells?.[d]?.code || '?'}`).join(' ');
    console.log(`- ${r.nombreVisible || r.nombre} (${r.empleado_id}): ${summary}`);
  }
}

execute().catch(console.error);
