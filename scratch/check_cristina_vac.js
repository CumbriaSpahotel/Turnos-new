const fs = require('fs');

async function checkData() {
    const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1";
    const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

    const fetchSupabase = async (path) => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const response = await fetch(url.toString(), {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`HTTP error! status: ${response.status} msg: ${txt}`);
        }
        return await response.json();
    };

    try {
        console.log("=== 1. AUDITAR EVENTO VAC DE CRISTINA ===");
        const eventos = await fetchSupabase("/eventos_cuadrante?select=*");
        const cristinaEventos = eventos.filter(e => {
            const matchesEmp = (e.empleado_id && e.empleado_id.toLowerCase().includes('cristina')) || 
                               (e.empleado_nombre && e.empleado_nombre.toLowerCase().includes('cristina')) ||
                               (e.payload && JSON.stringify(e.payload).toLowerCase().includes('cristina'));
            const isVac = e.tipo && e.tipo.toUpperCase().startsWith('VAC');
            const dateMatch = e.fecha_inicio <= '2026-04-26' && (e.fecha_fin || e.fecha_inicio) >= '2026-04-20';
            return matchesEmp && dateMatch && isVac;
        });
        console.log("Eventos Cristina:", JSON.stringify(cristinaEventos, null, 2));

        console.log("\n=== 4. VALIDAR QUE MIRIAM EXISTE EN EMPLEADOS Y TURNOS ===");
        const empleados = await fetchSupabase("/empleados?select=id,nombre,hotel_id,activo,id_interno");
        const miriam = empleados.filter(e => (e.nombre && e.nombre.toLowerCase().includes('miriam')) || (e.id && e.id.toLowerCase().includes('miriam')));
        console.log("Miriam en Empleados:", JSON.stringify(miriam, null, 2));

        const turnosMiriamCristina = await fetchSupabase("/turnos?fecha=gte.2026-04-20&fecha=lte.2026-04-26&select=fecha,hotel_id,empleado_id,turno");
        const filteredTurnos = turnosMiriamCristina.filter(t => (t.empleado_id && t.empleado_id.toLowerCase().includes('miriam')) || (t.empleado_id && t.empleado_id.toLowerCase().includes('cristina')));
        console.log("Turnos Miriam/Cristina 20/04-26/04:", JSON.stringify(filteredTurnos, null, 2));

        console.log("\n=== 5/6. REVISAR CÓDIGO V EN TABLA TURNOS ===");
        const turnosV = await fetchSupabase("/turnos?turno=eq.V&select=fecha,hotel_id,empleado_id,turno&limit=100");
        console.log("Turnos con V (muestra 100):", JSON.stringify(turnosV, null, 2));
        
    } catch (e) {
        console.error(e);
    }
}
checkData();
