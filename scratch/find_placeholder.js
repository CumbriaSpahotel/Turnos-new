const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEmployees() {
    console.log('Checking employees for "sin asignar" or "¿?"...');
    
    const { data: emps, error } = await supabase
        .from('empleados')
        .select('id, nombre, tipo_personal')
        .or('nombre.ilike.%sin asignar%,nombre.ilike.%¿?%,id.ilike.%sin asignar%,id.ilike.%¿?%');
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log(`Found ${emps.length} matches:`);
    emps.forEach(e => {
        console.log(`- ID: ${e.id} | Nombre: ${e.nombre} | Tipo: ${e.tipo_personal}`);
    });
}

checkEmployees();
