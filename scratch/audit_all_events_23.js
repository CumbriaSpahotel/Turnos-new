
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditAllEvents23() {
    console.log("Auditing ALL events for 2026-06-23 in Sercotel Guadiana...");
    
    const date = "2026-06-23";
    const hotel = "Sercotel Guadiana";
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?fecha_inicio=lte.${date}&fecha_fin=gte.${date}&hotel_origen=eq.${encodeURIComponent(hotel)}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log("Found events:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditAllEvents23();
