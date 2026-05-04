const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co', 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

async function audit2027() {
  const { data, error } = await client
    .from('publicaciones_cuadrante')
    .select('id, hotel, semana_inicio, semana_fin, version, estado, fecha_publicacion, created_at, updated_at, snapshot_json')
    .eq('estado', 'activo')
    .gte('semana_inicio', '2027-01-01')
    .lt('semana_inicio', '2028-01-01')
    .in('hotel', ['Cumbria Spa&Hotel', 'Sercotel Guadiana'])
    .order('hotel', { ascending: true })
    .order('semana_inicio', { ascending: true });

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  const hotels = {};
  data.forEach(p => {
    if (!hotels[p.hotel]) {
      hotels[p.hotel] = { count: 0, weeks: [], minV: 99999, maxV: 0, minW: '9999', maxW: '0000' };
    }
    hotels[p.hotel].count++;
    hotels[p.hotel].weeks.push(p);
    if (p.version < hotels[p.hotel].minV) hotels[p.hotel].minV = p.version;
    if (p.version > hotels[p.hotel].maxV) hotels[p.hotel].maxV = p.version;
    if (p.semana_inicio < hotels[p.hotel].minW) hotels[p.hotel].minW = p.semana_inicio;
    if (p.semana_fin > hotels[p.hotel].maxW) hotels[p.hotel].maxW = p.semana_fin;
  });

  console.log('--- RESUMEN POR HOTEL ---');
  for (const h of Object.keys(hotels)) {
    const st = hotels[h];
    console.log(`Hotel: ${h}`);
    console.log(`  Semanas Activas: ${st.count}`);
    console.log(`  Primera Semana: ${st.minW}`);
    console.log(`  Última Semana: ${st.maxW}`);
    console.log(`  Versiones: Min ${st.minV}, Max ${st.maxV}`);
  }

  console.log('\n--- INSPECCIÓN DE MUESTRAS ---');
  for (const h of Object.keys(hotels)) {
    const weeks = hotels[h].weeks;
    const samples = [
        weeks[0], 
        weeks[Math.floor(weeks.length / 4)],
        weeks[Math.floor(weeks.length / 2)],
        weeks[Math.floor(weeks.length * 3 / 4)],
        weeks[weeks.length - 1]
    ].filter(Boolean);

    const uniqueSamples = Array.from(new Set(samples));

    uniqueSamples.forEach(s => {
      const rows = s.snapshot_json?.rows || [];
      const firstRow = rows[0] || {};
      const cells = firstRow.turnosOperativos || firstRow.dias || firstRow.cells || {};
      const keys = Object.keys(cells);
      
      console.log(`Muestra [${h}] ${s.semana_inicio} (v${s.version})`);
      console.log(`  Filas: ${rows.length}`);
      console.log(`  Primer Empleado: ${firstRow.empleado || firstRow.ocupante || 'N/A'}`);
      console.log(`  Claves de fechas: ${keys.slice(0, 3).join(', ')}...`);
      
      // Let's also check a sample of days to see if they are just "—"
      let emptyCount = 0;
      let totalCount = 0;
      for (const row of rows) {
          const rowCells = row.turnosOperativos || row.dias || row.cells || {};
          for (const key of Object.keys(rowCells)) {
              totalCount++;
              if (rowCells[key] === '—' || rowCells[key] === '-' || !rowCells[key]) {
                  emptyCount++;
              }
          }
      }
      const emptyRatio = totalCount > 0 ? (emptyCount / totalCount * 100).toFixed(1) : 0;
      console.log(`  Ratio celdas vacías: ${emptyRatio}% (${emptyCount}/${totalCount})`);
      if (emptyRatio > 90) {
          console.log(`  >>> ADVERTENCIA: Esta semana parece no tener datos reales.`);
      }
    });
  }
}

audit2027();
