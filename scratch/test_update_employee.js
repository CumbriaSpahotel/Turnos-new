const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUpdateEmployee() {
    console.log("Testing UPDATE on empleados...");
    
    const { data: emps } = await client.from('empleados').select('*').limit(1);
    if (!emps || emps.length === 0) {
        console.log("No employees found to test.");
        return;
    }
    
    const emp = emps[0];
    console.log("Found employee:", emp.id, emp.nombre);
    
    const { data, error } = await client
        .from('empleados')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', emp.id)
        .select();

    if (error) {
        console.error("Update Error:", error);
    } else {
        console.log("Update Success:", data[0].id);
    }
}

testUpdateEmployee();
