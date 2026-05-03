const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSergioTurns() {
    console.log("[CHECKING SERGIO TURNS]");
    const { data: turns, error } = await supabase
        .from('turnos')
        .select('*')
        .eq('empleado_id', 'Sergio Sánchez')
        .gte('fecha', '2026-04-27')
        .lte('fecha', '2026-05-03');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${turns.length} turns for Sergio Sánchez in week 27/04:`);
    turns.forEach(t => {
        console.log(`- ${t.fecha}: ${t.turno} | Hotel: ${t.hotel_id}`);
    });
}

checkSergioTurns();
