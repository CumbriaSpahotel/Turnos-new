const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectEventRaw() {
    console.log("[RAW EVENT INSPECTION]");
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .eq('id', 'e2e67f27-fa94-46a0-80b2-34a8c44d949f');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(JSON.stringify(events[0], null, 2));
}

inspectEventRaw();
