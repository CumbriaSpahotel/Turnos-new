const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testExactRead() {
    console.log("Testing EXACT READ from publicaciones_cuadrante...");
    
    // Exact filters from user's failed request
    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('semana_inicio', '2026-04-20')
        .eq('hotel', 'Cumbria Spa&Hotel')
        .eq('estado', 'activo')
        .neq('id', 'c31e6126-d299-4173-ba36-67affa351ea3');

    if (error) {
        console.error("Read Error:", error);
    } else {
        console.log("Read Success, count:", data.length);
    }
}

testExactRead();
