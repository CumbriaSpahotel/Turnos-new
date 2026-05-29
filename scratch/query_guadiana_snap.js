const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking Guadiana active publication rows...");
  const { data, error } = await supabase
    .from('publicaciones_cuadrante')
    .select('*')
    .eq('semana_inicio', '2026-06-01')
    .eq('hotel', 'Sercotel Guadiana')
    .eq('estado', 'activo')
    .single();
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Guadiana snap ID:", data.id);
    const rows = data.snapshot_json.rows || data.snapshot_json.empleados || [];
    console.log("Employees in snapshot:", rows.map(r => r.nombre));
  }
}

check();
