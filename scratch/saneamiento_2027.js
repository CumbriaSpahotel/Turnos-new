const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co', 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

async function sanear2027() {
  console.log("=== 1. PRECHECK ANTES DE SANEAR ===");
  
  const { data: precheckData } = await client
    .from('publicaciones_cuadrante')
    .select('id, hotel, semana_inicio, estado, version')
    .gte('semana_inicio', '2027-01-01')
    .lt('semana_inicio', '2028-01-01')
    .in('hotel', ['Cumbria Spa&Hotel', 'Sercotel Guadiana']);

  const activeRecords = precheckData.filter(d => d.estado === 'activo');
  console.log(`Total registros en 2027: ${precheckData.length}`);
  console.log(`Total registros ACTIVOS en 2027: ${activeRecords.length}`);
  
  const byHotel = {};
  activeRecords.forEach(r => {
      if(!byHotel[r.hotel]) byHotel[r.hotel] = new Set();
      byHotel[r.hotel].add(r.semana_inicio);
  });
  console.log(`Cumbria Semanas Únicas Activas: ${byHotel['Cumbria Spa&Hotel'] ? byHotel['Cumbria Spa&Hotel'].size : 0}`);
  console.log(`Sercotel Semanas Únicas Activas: ${byHotel['Sercotel Guadiana'] ? byHotel['Sercotel Guadiana'].size : 0}`);

  console.log("\n=== 2. SANEAR SOLO 2027 ===");
  const { data: updated, error } = await client
    .from('publicaciones_cuadrante')
    .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
    .gte('semana_inicio', '2027-01-01')
    .lt('semana_inicio', '2028-01-01')
    .in('hotel', ['Cumbria Spa&Hotel', 'Sercotel Guadiana'])
    .eq('estado', 'activo')
    .select('id, hotel, semana_inicio, version, estado');

  if (error) {
    console.error("Error saneando 2027:", error);
    return;
  }
  
  console.log(`Registros actualizados a 'inactivo': ${updated ? updated.length : 0}`);

  console.log("\n=== 3. VALIDACIÓN POST-SANEO 2027 ===");
  const { data: postcheckData } = await client
    .from('publicaciones_cuadrante')
    .select('id')
    .gte('semana_inicio', '2027-01-01')
    .lt('semana_inicio', '2028-01-01')
    .in('hotel', ['Cumbria Spa&Hotel', 'Sercotel Guadiana'])
    .eq('estado', 'activo');
    
  console.log(`Registros ACTIVOS restantes en 2027: ${postcheckData ? postcheckData.length : 0}`);
}

sanear2027();
