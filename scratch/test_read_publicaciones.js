const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRead() {
    console.log("Testing READ from publicaciones_cuadrante...");
    
    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .select('*')
        .limit(5);

    if (error) {
        console.error("Read Error:", error);
    } else {
        console.log("Read Success, count:", data.length);
        console.log("First row summary:", data[0] ? { id: data[0].id, semana: data[0].semana_inicio, hotel: data[0].hotel } : "None");
    }
}

testRead();
