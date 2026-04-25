const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTable() {
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .limit(1);
    
    if (error) {
        console.log("Error checking table:", error.code, error.message);
    } else {
        console.log("Table exists and is accessible.");
    }
}

checkTable();
