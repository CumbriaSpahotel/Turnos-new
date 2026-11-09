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
  console.log("=== ACTUALIZANDO TURNOS BASE LUNES 09/11/2026 (SERCOTEL GUADIANA) ===");
  console.log("- Macarena: Mañana (M)");
  console.log("- Elena (EMP-0018): Tarde (T)");
  console.log("- Dani: Noche (N)");

  // 1. Actualizar Macarena
  const resMac = await fetch(`${url}/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Macarena&fecha=eq.2026-11-09`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      turno: 'M',
      tipo: 'NORMAL',
      updated_at: new Date().toISOString(),
      updated_by: 'ADMIN_MANUAL_UPDATE'
    })
  });
  console.log("Update Macarena:", resMac.status, await resMac.json());

  // 2. Actualizar Elena (EMP-0018)
  const resEle = await fetch(`${url}/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.EMP-0018&fecha=eq.2026-11-09`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      turno: 'T',
      tipo: 'NORMAL',
      updated_at: new Date().toISOString(),
      updated_by: 'ADMIN_MANUAL_UPDATE'
    })
  });
  console.log("Update Elena:", resEle.status, await resEle.json());

  // 3. Actualizar Dani
  const resDani = await fetch(`${url}/rest/v1/turnos?hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Dani&fecha=eq.2026-11-09`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      turno: 'N',
      tipo: 'NORMAL',
      updated_at: new Date().toISOString(),
      updated_by: 'ADMIN_MANUAL_UPDATE'
    })
  });
  console.log("Update Dani:", resDani.status, await resDani.json());

  // 4. Publicar Snapshot actualizado en publicaciones_cuadrante
  console.log("\n=== ACTUALIZANDO SNAPSHOT DE PUBLICACIÓN ===");
  const resPub = await fetch(`${url}/rest/v1/publicaciones_cuadrante?hotel=eq.Sercotel%20Guadiana&semana_inicio=eq.2026-11-09&order=version.desc&limit=1&select=*`, { headers: HEADERS });
  const [currentPub] = await resPub.json();
  if (!currentPub) {
    throw new Error("No se encontró publicación previa para clonar.");
  }

  const nextVersion = (currentPub.version || 0) + 1;
  const snapJson = JSON.parse(JSON.stringify(currentPub.snapshot_json));
  const rows = snapJson.rows || snapJson.empleados || [];

  for (const r of rows) {
    const name = String(r.nombreVisible || r.nombre || '').trim().toLowerCase();
    const id = String(r.empleado_id || '').trim().toLowerCase();

    if (name.includes('macarena') || id.includes('macarena') || id === 'emp-0008') {
      const cell = r.cells?.['2026-11-09'] || r.dias?.['2026-11-09'];
      if (cell) {
        cell.code = 'M';
        cell.label = 'Mañana';
        cell.turno = 'M';
        cell.icons = ['☀️'];
        cell.changed = true;
        cell.origen = 'CAMBIO_TURNO';
        cell.title = 'Cambio de turno manual: Mañana';
      }
      if (r.cells?.['2026-11-09'] && r.dias?.['2026-11-09']) {
        r.dias['2026-11-09'] = cell;
      }
    }

    if (name.includes('elena') || id.includes('elena') || id === 'emp-0018') {
      const cell = r.cells?.['2026-11-09'] || r.dias?.['2026-11-09'];
      if (cell) {
        cell.code = 'T';
        cell.label = 'Tarde';
        cell.turno = 'T';
        cell.icons = ['🌅'];
        cell.changed = true;
        cell.origen = 'CAMBIO_TURNO';
        cell.title = 'Cambio de turno manual: Tarde';
      }
      if (r.cells?.['2026-11-09'] && r.dias?.['2026-11-09']) {
        r.dias['2026-11-09'] = cell;
      }
    }

    if (name.includes('dani') || id.includes('dani') || id === 'emp-0002') {
      const cell = r.cells?.['2026-11-09'] || r.dias?.['2026-11-09'];
      if (cell) {
        cell.code = 'N';
        cell.label = 'Noche';
        cell.turno = 'N';
        cell.icons = ['🌙'];
        cell.changed = true;
        cell.origen = 'CAMBIO_TURNO';
        cell.title = 'Cambio de turno manual: Noche';
      }
      if (r.cells?.['2026-11-09'] && r.dias?.['2026-11-09']) {
        r.dias['2026-11-09'] = cell;
      }
    }
  }

  // Insertar nueva versión vNext
  const newPubPayload = {
    semana_inicio: '2026-11-09',
    semana_fin: '2026-11-15',
    hotel: 'Sercotel Guadiana',
    snapshot_json: {
      ...snapJson,
      metadata: {
        ...(snapJson.metadata || {}),
        rollback_target: currentPub.id,
        published_at: new Date().toISOString(),
        manual_adjustment: 'Macarena M, Elena T, Dani N on 2026-11-09'
      }
    },
    resumen: currentPub.resumen,
    publicado_por: 'ADMIN',
    version: nextVersion,
    estado: 'activo',
    fecha_publicacion: new Date().toISOString()
  };

  const resInsert = await fetch(`${url}/rest/v1/publicaciones_cuadrante`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(newPubPayload)
  });
  console.log(`Insert publicación v${nextVersion}:`, resInsert.status);
  const insertedPub = await resInsert.json();

  // Llamar RPC cleanup_publicacion_activa
  const resRpc = await fetch(`${url}/rest/v1/rpc/cleanup_publicacion_activa`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      p_hotel: 'Sercotel Guadiana',
      p_semana_inicio: '2026-11-09'
    })
  });
  console.log("Cleanup RPC status:", resRpc.status);

  console.log("\n=== VERIFICACIÓN FINAL ===");
  const resCheck = await fetch(`${url}/rest/v1/publicaciones_cuadrante?hotel=eq.Sercotel%20Guadiana&semana_inicio=eq.2026-11-09&estado=eq.activo&order=version.desc&limit=1&select=*`, { headers: HEADERS });
  const [activeCheck] = await resCheck.json();
  console.log(`Publicación activa final: v${activeCheck.version}`);
  const activeRows = activeCheck.snapshot_json?.rows || [];
  for (const r of activeRows) {
    if (['Macarena', 'Elena', 'Dani', 'Cristina', 'Marcos', 'Diana'].includes(r.nombreVisible || r.nombre)) {
      console.log(`- ${r.nombreVisible || r.nombre}: ${r.cells?.['2026-11-09']?.label} (${r.cells?.['2026-11-09']?.code})`);
    }
  }
}

execute().catch(console.error);
