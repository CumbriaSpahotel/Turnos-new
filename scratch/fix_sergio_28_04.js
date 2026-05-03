const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixSergioEvent() {
    const eventId = 'e2e67f27-fa94-46a0-80b2-34a8c44d949f';
    const targetId = 'Sergio';
    const targetUuid = '16d2a25f-def3-4083-b350-8040309e3366';
    const targetNombre = 'Sergio';

    console.log(`[FIX] Updating event ${eventId}...`);

    const { data, error } = await supabase
        .from('eventos_cuadrante')
        .update({
            empleado_id: targetId,
            empleado_uuid: targetUuid,
            updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .select();

    if (error) {
        console.error("Error updating event:", error);
        return;
    }

    console.log("Event updated successfully:", data);
}

fixSergioEvent();
