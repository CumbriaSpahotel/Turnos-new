
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditSergioTurnos() {
    console.log("Auditing Sergio's turnos on April 28th...");
    
    const url = `${SUPABASE_URL}/rest/v1/turnos?fecha=eq.2026-04-28&empleado_id=ilike.*Sergio*`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log("Turnos for Sergio on April 28th:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditSergioTurnos();
