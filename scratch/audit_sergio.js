
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditSergio() {
    console.log("Auditing Sergio's April 28th PERMISO event...");
    
    // Search for Sergio in eventos_cuadrante
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?fecha_inicio=lte.2026-04-28&fecha_fin=gte.2026-04-28&empleado_id=ilike.*Sergio*`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Matches found:", JSON.stringify(data, null, 2));
        
        if (data.length === 0) {
            console.log("No exact date match found. Searching for all Sergio's events in April...");
            const url2 = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?fecha_inicio=gte.2026-04-01&fecha_inicio=lte.2026-04-30&empleado_id=ilike.*Sergio*`;
            const response2 = await fetch(url2, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            const data2 = await response2.json();
            console.log("April events for Sergio:", JSON.stringify(data2, null, 2));
        }
    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditSergio();
