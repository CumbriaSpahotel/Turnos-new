const { createClient } = require("@supabase/supabase-js");
const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

const corrections = [
    { id: "1b815602-5c31-487b-a010-3882775f2843", orig: "T", new: "M", hotel: "Sercotel Guadiana", fecha: "2026-04-06" },
    { id: "3581414b-57f9-4d64-9ca5-e8d1a499d375", orig: "T", new: "D", hotel: "Sercotel Guadiana", fecha: "2026-04-10" },
    { id: "64dc9deb-6569-4e7a-9a9f-3957f082e666", orig: "D", new: "M", hotel: "Sercotel Guadiana", fecha: "2026-04-25" },
    { id: "822acecf-2c23-4cb1-be03-3bfd094e0517", orig: "D", new: "M", hotel: "Sercotel Guadiana", fecha: "2026-04-26" }
];

async function runCorrections() {
    console.log("Iniciando CORRECCIÓN TÉCNICA SERCOTEL...");
    for (const c of corrections) {
        console.log(`Actualizando ${c.id} (${c.fecha})...`);
        const { data, error, count } = await client
            .from("eventos_cuadrante")
            .update({ turno_original: c.orig, turno_nuevo: c.new, updated_at: new Date().toISOString(), updated_by: "IA_V12_1_CT_FIX" })
            .eq("id", c.id)
            .eq("hotel_origen", c.hotel)
            .eq("fecha_inicio", c.fecha)
            .select();

        if (error) {
            console.error(`  ❌ Error:`, error);
        } else if (data.length === 1) {
            console.log(`  ✅ OK. Filas afectadas: 1`);
        } else {
            console.warn(`  ⚠️ Advertencia: Filas afectadas = ${data.length}`);
        }
    }
    console.log("PROCESO FINALIZADO.");
}

runCorrections();
