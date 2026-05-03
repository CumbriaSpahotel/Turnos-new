
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditJuneEvents() {
    console.log("Auditing all events for Diana or Dani in June 2026...");
    
    const start = "2026-06-01";
    const end = "2026-06-30";
    
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?fecha_inicio=gte.${start}&fecha_inicio=lte.${end}&or=(empleado_id.ilike.*Diana*,empleado_id.ilike.*Dani*,empleado_destino_id.ilike.*Diana*,empleado_destino_id.ilike.*Dani*)`;
    
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

auditJuneEvents();
