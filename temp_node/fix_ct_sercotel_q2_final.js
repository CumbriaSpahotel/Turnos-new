const { createClient } = require("@supabase/supabase-js");
const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

const corrections = [
    { id: "d6b8a402-0502-4f3b-b112-bf03723ff8ce", orig: "T", new: "M", hotel: "Sercotel Guadiana", fecha: "2026-04-06" },
    { id: "b49b4f09-a98e-4717-b65f-cd34dd200bad", orig: "T", new: "D", hotel: "Sercotel Guadiana", fecha: "2026-04-10" },
    { id: "4e6be018-038c-4f12-8706-96b6f0088dad", orig: "D", new: "M", hotel: "Sercotel Guadiana", fecha: "2026-04-25" },
    { id: "e8b0acd3-b683-4a14-8d5e-caf9d56e28d7", orig: "D", new: "M", hotel: "Sercotel Guadiana", fecha: "2026-04-26" }
];

async function runCorrections() {
    console.log("Iniciando CORRECCIÓN TÉCNICA SERCOTEL (IDs FINAL)...");
    for (const c of corrections) {
        const { data, error } = await client
            .from("eventos_cuadrante")
            .update({ turno_original: c.orig, turno_nuevo: c.new, updated_at: new Date().toISOString(), updated_by: "IA_V12_1_CT_FIX" })
            .eq("id", c.id)
            .eq("hotel_origen", c.hotel)
            .eq("fecha_inicio", c.fecha)
            .select();

        if (error) console.error(`  ❌ Error ${c.id}:`, error);
        else console.log(`  ✅ OK ${c.id}. Filas: ${data.length}`);
    }
}
runCorrections();
