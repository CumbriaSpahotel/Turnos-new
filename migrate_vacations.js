const { createClient } = require('./temp_node/node_modules/@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log("🚀 Iniciando migración de vacaciones...");
    
    const vacsRaw = JSON.parse(fs.readFileSync('vacs_final.json', 'utf8'));
    
    // Agrupar por empleado y rango para optimizar? No, Supabase maneja bien lotes.
    // Pero debemos mapear nombres de hotel
    const normalizedVacs = vacsRaw.map(v => {
        let h = v.hotel_id;
        if (h.toUpperCase().includes('GUADIANA')) h = 'Sercotel Guadiana';
        if (h.toUpperCase().includes('CUMBRIA')) h = 'Cumbria Spa&Hotel';
        
        return {
            empleado_id: v.empleado_id,
            fecha: v.fecha,
            hotel_id: h,
            turno: 'V', // Abreviatura usada en el sistema para renderizado
            tipo: 'VAC 🏖️', // El emoji es importante para el estilo CSS v-vac
            sustituto: v.sustituto || '',
            updated_by: 'MIGRACION_IA',
            updated_at: new Date().toISOString()
        };
    });

    console.log(`📦 Preparados ${normalizedVacs.length} registros.`);

    // Insertar en lotes de 100 para evitar límites
    const batchSize = 100;
    for (let i = 0; i < normalizedVacs.length; i += batchSize) {
        const batch = normalizedVacs.slice(i, i + batchSize);
        const { error } = await supabase
            .from('turnos')
            .upsert(batch, { onConflict: 'empleado_id,fecha' });
        
        if (error) {
            console.error(`❌ Error en lote ${i}:`, error.message);
        } else {
            console.log(`✅ Lote ${i} / ${normalizedVacs.length} completado.`);
        }
    }

    console.log("🎉 Migración finalizada.");
}

run();
