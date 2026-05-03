const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEmployees() {
    console.log("[EMPLOYEE HOTEL CHECK]");
    const { data: emps, error } = await supabase
        .from('empleados')
        .select('*')
        .or('nombre.ilike.%sergio%,nombre.ilike.%natalio%');

    if (error) {
        console.error("Error:", error);
        return;
    }

    emps.forEach(e => {
        console.log(`${e.nombre}: Hotel=${e.hotel}, ID=${e.id}`);
    });
}

checkEmployees();
