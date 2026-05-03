
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditExchange() {
    console.log("Auditing Diana <-> Dani Exchange on June 23rd...");
    
    // Search for Diana or Dani on 2026-06-23 in Sercotel Guadiana
    const date = "2026-06-23";
    const hotel = "Sercotel Guadiana";
    
    // Using OR filter for both names
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?fecha_inicio=lte.${date}&fecha_fin=gte.${date}&or=(empleado_id.ilike.*Diana*,empleado_id.ilike.*Dani*,empleado_destino_id.ilike.*Diana*,empleado_destino_id.ilike.*Dani*)`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log("Found events:", JSON.stringify(data, null, 2));
        
        // Also check turnos base
        console.log("\nChecking base turns...");
        const urlTurnos = `${SUPABASE_URL}/rest/v1/turnos?fecha=eq.${date}&hotel_id=eq.${encodeURIComponent(hotel)}`;
        const responseTurnos = await fetch(urlTurnos, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const dataTurnos = await responseTurnos.json();
        const dianaTurno = dataTurnos.find(t => t.empleado_id.toLowerCase().includes('diana'));
        const daniTurno = dataTurnos.find(t => t.empleado_id.toLowerCase().includes('dani'));
        console.log("Diana Base:", dianaTurno);
        console.log("Dani Base:", daniTurno);

    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditExchange();
