const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data: turnos, error } = await client
        .from('turnos')
        .select('*')
        .eq('hotel_id', 'Cumbria Spa&Hotel')
        .limit(10);
        
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(turnos);
}

run();
