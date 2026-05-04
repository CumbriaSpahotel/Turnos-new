const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEventDetail() {
    const eventId = "1847beed-b7b2-49f1-b057-69731e5fcb57";
    console.log(`Checking detail for event ${eventId}...`);
    
    const { data: ev, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .eq('id', eventId)
        .single();
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('Event Detail:', JSON.stringify(ev, null, 2));
}

checkEventDetail();
