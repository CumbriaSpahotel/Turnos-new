
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditAllApril28() {
    console.log("Auditing all events on April 28th...");
    
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?fecha_inicio=lte.2026-04-28&fecha_fin=gte.2026-04-28`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log("Events on April 28th:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditAllApril28();
