const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditAllEvents() {
    const start = "2026-01-01";
    const end = "2026-12-31";
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?fecha_inicio=gte.${start}&fecha_inicio=lte.${end}&or=(empleado_id.ilike.*Diana*,empleado_id.eq.EMP-0009,empleado_destino_id.ilike.*Diana*,empleado_destino_id.eq.EMP-0009)`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log(`TOTAL EVENTS IN 2026: ${data.length}`);
        data.forEach(ev => {
            console.log(`- ID: ${ev.id}, Tipo: ${ev.tipo}, Estado: ${ev.estado}, Inicio: ${ev.fecha_inicio}, Fin: ${ev.fecha_fin}, Emp: ${ev.empleado_id}, Dest: ${ev.empleado_destino_id}, Motivo/Obs: ${ev.observaciones || ev.payload?.motivo || ''}`);
        });
    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditAllEvents();
