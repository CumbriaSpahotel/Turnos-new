const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testExactUserQuery() {
    console.log("Testing exact user query that failed in browser...");
    
    // URL: .../publicaciones_cuadrante?semana_inicio=eq.2026-04-20&hotel=eq.Sercotel+Guadiana&estado=eq.activo&id=neq.53e38419-b26a-40e6-a729-1187f05175b9
    
    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('semana_inicio', '2026-04-20')
        .eq('hotel', 'Sercotel Guadiana')
        .eq('estado', 'activo')
        .neq('id', '53e38419-b26a-40e6-a729-1187f05175b9');

    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log("Query Success! Count:", data.length);
        if (data.length > 0) {
            console.log("First row ID:", data[0].id);
        }
    }
}

testExactUserQuery();
