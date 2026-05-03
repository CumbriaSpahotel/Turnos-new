
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditSergioWeek() {
    console.log("Auditing Sergio's turnos for week 2026-04-27...");
    
    const url = `${SUPABASE_URL}/rest/v1/turnos?fecha=gte.2026-04-27&fecha=lte.2026-05-03&empleado_id=ilike.*Sergio*`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log("Turnos for Sergio week 2026-04-27:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditSergioWeek();
