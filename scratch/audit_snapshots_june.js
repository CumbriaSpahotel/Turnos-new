
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditSnapshots() {
    console.log("Auditing ALL snapshots for Sercotel Guadiana in June 2026...");
    
    const hotel = "Sercotel Guadiana";
    const url = `${SUPABASE_URL}/rest/v1/publicaciones_cuadrante?hotel=eq.${encodeURIComponent(hotel)}&semana_inicio=gte.2026-06-01&semana_inicio=lte.2026-06-30&order=version.desc`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log("Snapshots found:", JSON.stringify(data.map(s => ({
            version: s.version,
            semana_inicio: s.semana_inicio,
            estado: s.estado,
            created_at: s.created_at
        })), null, 2));
    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditSnapshots();
