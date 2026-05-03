
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function checkSnapshots() {
    console.log("Checking snapshots for week of 2026-06-22...");
    
    const week = "2026-06-22";
    const hotel = "Sercotel Guadiana";
    
    const url = `${SUPABASE_URL}/rest/v1/publicaciones_cuadrante?semana_inicio=eq.${week}&hotel=eq.${encodeURIComponent(hotel)}&order=version.desc`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log("Snapshots found:", data.length);
        if (data.length > 0) {
            console.log("Latest version:", data[0].version);
            console.log("Published by:", data[0].publicado_por);
            console.log("Created at:", data[0].created_at);
            
            // Search for Diana/Dani in the snapshot
            const snap = data[0].snapshot_json;
            const rows = snap.rows || [];
            const dianaRow = rows.find(r => r.empleadoId && r.empleadoId.toLowerCase().includes('diana'));
            const daniRow = rows.find(r => r.empleadoId && r.empleadoId.toLowerCase().includes('dani'));
            
            console.log("\nDiana in snapshot:", dianaRow ? "Found" : "Not found");
            if (dianaRow) {
                const cell = dianaRow.dias ? dianaRow.dias["2026-06-23"] : null;
                console.log("Diana cell for 23/06:", JSON.stringify(cell, null, 2));
            }
            
            console.log("\nDani in snapshot:", daniRow ? "Found" : "Not found");
            if (daniRow) {
                const cell = daniRow.dias ? daniRow.dias["2026-06-23"] : null;
                console.log("Dani cell for 23/06:", JSON.stringify(cell, null, 2));
            }
        } else {
            console.log("No snapshot found for this week.");
        }
    } catch (error) {
        console.error("Error checking snapshots:", error);
    }
}

checkSnapshots();
