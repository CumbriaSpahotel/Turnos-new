const { createClient } = require("@supabase/supabase-js");
const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

const plan = [
    { fecha: "2026-04-06", emp: "Diana", orig: "T", new: "M" },
    { fecha: "2026-04-10", emp: "Diana", orig: "D", new: "T" },
    { fecha: "2026-04-10", emp: "Dani", orig: "T", new: "D" },
    { fecha: "2026-04-25", emp: "Dani", orig: "D", new: "M" },
    { fecha: "2026-04-26", emp: "Dani", orig: "D", new: "M" }
];

async function fixAll() {
    console.log("Iniciando LIMPIEZA MASIVA DE CT EN SERCOTEL (4 fechas)...");
    for (const p of plan) {
        console.log(`Buscando y corrigiendo ${p.emp} en ${p.fecha}...`);
        const { data, error } = await client
            .from("eventos_cuadrante")
            .update({ turno_original: p.orig, turno_nuevo: p.new, updated_at: new Date().toISOString(), updated_by: "IA_V12_1_CT_FIX" })
            .eq("hotel_origen", "Sercotel Guadiana")
            .eq("fecha_inicio", p.fecha)
            .eq("empleado_id", p.emp)
            .select();
        
        if (error) console.error(`  ❌ Error ${p.emp}_${p.fecha}:`, error);
        else console.log(`  ✅ OK. ${data.length} registros corregidos.`);
    }
}
fixAll();
