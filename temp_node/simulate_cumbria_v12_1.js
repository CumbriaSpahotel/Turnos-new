const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

async function simulateCumbriaWeek() {
    const weekStart = "2026-03-30";
    const hotel = "Cumbria Spa&Hotel";
    
    // Cargar datos reales
    const { data: legacySnaps } = await client.from("publicaciones_cuadrante")
        .select("*")
        .eq("hotel", hotel)
        .eq("semana_inicio", weekStart)
        .order("version", { ascending: false });
    
    const { data: events } = await client.from("eventos_cuadrante")
        .select("*")
        .eq("hotel_origen", hotel)
        .gte("fecha_inicio", "2026-03-30")
        .lte("fecha_inicio", "2026-04-05");

    const baseSnap = legacySnaps[0];
    if (!baseSnap) { console.log("No base snap"); return; }

    const rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];
    
    console.log("--- SIMULACIÓN V12.1 vs VISTA PREVIA ADMIN ---");
    console.log(`Semana: ${weekStart} Hotel: ${hotel}`);

    const targetTruth = {
        "Cristina": { "2026-04-01": "Tarde 🔄" },
        "Miriam": { "2026-04-01": "Mañana 🔄" },
        "Esther": { "rowType": "ausencia_informativa", "status": "Vacaciones 🏖️" }
    };

    // Ver qué tiene el builder actualmente para el 01/04
    const cristinaEvent = events.find(e => e.empleado_id === "Cristina" && e.fecha_inicio === "2026-04-01");
    console.log("Evento Cristina 01/04 en DB:", JSON.stringify(cristinaEvent, null, 2));

    const builderOutput = [];
    // (Lógica simplificada del builder para reporte)
    rows.forEach(r => {
        const emp = r.nombre;
        const cell0104 = (r.dias || r.cells || {})["2026-04-01"];
        builderOutput.push({ nombre: emp, base0104: cell0104?.code || "—" });
    });

    console.log("Salida Builder Actual (01/04):", JSON.stringify(builderOutput, null, 2));
}

simulateCumbriaWeek();
