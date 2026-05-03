const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectEmployeesRaw() {
    console.log("[RAW EMPLOYEE INSPECTION]");
    const { data: emps, error } = await supabase
        .from('empleados')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Columns:", Object.keys(emps[0]));
}

inspectEmployeesRaw();
