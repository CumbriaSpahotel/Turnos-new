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

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function execute() {
  console.log("=== INICIANDO ACTUALIZACIÓN DE TURNOS ===");
  console.log("Semana: 09/11/2026 a 15/11/2026 (Cumbria Spa&Hotel)");
  console.log("Federico coge los turnos de Natalio (T, D, D, T, T, N, N). Natalio queda sin asignación esa semana.");

  const shiftsToApply = [
    { fecha: '2026-11-09', turno: 'T' },
    { fecha: '2026-11-10', turno: 'D' },
    { fecha: '2026-11-11', turno: 'D' },
    { fecha: '2026-11-12', turno: 'T' },
    { fecha: '2026-11-13', turno: 'T' },
    { fecha: '2026-11-14', turno: 'N' },
    { fecha: '2026-11-15', turno: 'N' }
  ];

  // 1. Actualizar turnos de Federico
  for (const s of shiftsToApply) {
    const updatePayload = {
      turno: s.turno,
      tipo: 'NORMAL',
      updated_at: new Date().toISOString(),
      updated_by: 'ADMIN_MANUAL_UPDATE'
    };
    const res = await fetchWithRetry(
      `${url}/rest/v1/turnos?empleado_id=eq.Federico&fecha=eq.${s.fecha}`,
      {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify(updatePayload)
      }
    );
    if (!res.ok) {
      console.error(`Error actualizando turno Federico en ${s.fecha}:`, await res.text());
    } else {
      console.log(`Federico ${s.fecha} actualizado a '${s.turno}'`);
    }
  }

  // 2. Eliminar turnos de Natalio para esa semana en Cumbria Spa&Hotel
  const resDel = await fetchWithRetry(
    `${url}/rest/v1/turnos?empleado_id=eq.Natalio&fecha=gte.2026-11-09&fecha=lte.2026-11-15&hotel_id=eq.Cumbria%20Spa%26Hotel`,
    {
      method: 'DELETE',
      headers: HEADERS
    }
  );
  if (!resDel.ok) {
    console.error("Error eliminando turnos de Natalio:", await resDel.text());
  } else {
    console.log("Turnos de Natalio eliminados para la semana 09/11/2026 - 15/11/2026 en Cumbria Spa&Hotel.");
  }

  // 3. Verificación
  console.log("\n=== VERIFICACIÓN POST-ACTUALIZACIÓN ===");
  const rFed = await fetchWithRetry(`${url}/rest/v1/turnos?empleado_id=eq.Federico&fecha=gte.2026-11-09&fecha=lte.2026-11-15&order=fecha.asc&select=*`, { headers: HEADERS });
  console.log("Turnos Federico:", await rFed.json());

  const rNat = await fetchWithRetry(`${url}/rest/v1/turnos?empleado_id=eq.Natalio&fecha=gte.2026-11-09&fecha=lte.2026-11-15&order=fecha.asc&select=*`, { headers: HEADERS });
  console.log("Turnos Natalio:", await rNat.json());

  const rAllCumbria = await fetchWithRetry(`${url}/rest/v1/turnos?hotel_id=eq.Cumbria%20Spa%26Hotel&fecha=gte.2026-11-09&fecha=lte.2026-11-15&order=fecha.asc,empleado_id.asc&select=empleado_id,fecha,turno`, { headers: HEADERS });
  const allCumbria = await rAllCumbria.json();
  console.log("\nCobertura total Cumbria para la semana:");
  const byDate = {};
  for (const t of allCumbria) {
    byDate[t.fecha] = byDate[t.fecha] || [];
    byDate[t.fecha].push(`${t.empleado_id}: ${t.turno}`);
  }
  for (const [f, list] of Object.entries(byDate)) {
    console.log(`${f} -> ${list.join(' | ')}`);
  }
}

execute().catch(console.error);
