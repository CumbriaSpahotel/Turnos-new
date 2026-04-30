const { createClient } = require("@supabase/supabase-js");
const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

async function checkDianaDani() {
    const hotel = "Sercotel Guadiana";
    const date = "2026-05-15";
    const emps = ["Diana", "Dani"];

    const { data: tbase } = await client.from("turnos").select("*").eq("hotel_id", hotel).eq("fecha", date).in("empleado_id", emps);
    const { data: events } = await client.from("eventos_cuadrante").select("*").eq("hotel_origen", hotel).eq("fecha_inicio", date).eq("estado", "activo");

    const exchEv = events.find(e => (e.empleado_id === "Dani" || e.empleado_destino_id === "Dani") && (e.tipo === "INTERCAMBIO_TURNO" || e.tipo === "CAMBIO_TURNO"));

    console.log("EVENTO:", JSON.stringify(exchEv, null, 2));

    emps.forEach(empName => {
        let code = (exchEv.empleado_id === empName) ? exchEv.turno_nuevo : exchEv.turno_original;
        let partner = (exchEv.empleado_id === empName) ? exchEv.empleado_destino_id : exchEv.empleado_id;
        
        console.log(`\n--- ${empName} ---`);
        console.log(`Code Inicial: "${code}"`);
        
        if (!code || code === "CT") {
            const t = tbase.find(tb => tb.empleado_id === partner && tb.fecha === date);
            console.log(`Triggered fallback for ${empName}. Partner: ${partner}. Partner Base: ${t?.turno}`);
            code = t?.turno;
        }
        console.log(`Code Final: ${code}`);
    });
}
checkDianaDani();
