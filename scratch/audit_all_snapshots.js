
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditAllSnapshots() {
    console.log("Auditing ALL snapshots for Sercotel Guadiana...");
    
    const hotel = "Sercotel Guadiana";
    const url = `${SUPABASE_URL}/rest/v1/publicaciones_cuadrante?hotel=eq.${encodeURIComponent(hotel)}&order=semana_inicio.desc,version.desc&limit=20`;
    
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

auditAllSnapshots();
