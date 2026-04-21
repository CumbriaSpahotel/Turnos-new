const { createClient } = require('./temp_node/node_modules/@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log("🚀 Iniciando migración de Bajas y Permisos...");
    
    const dataRaw = JSON.parse(fs.readFileSync('bajas_final.json', 'utf8'));
    
    const normalized = dataRaw.map(v => {
        let h = v.hotel_id;
        if (h.toUpperCase().includes('GUADIANA')) h = 'Sercotel Guadiana';
        if (h.toUpperCase().includes('CUMBRIA')) h = 'Cumbria Spa&Hotel';
        
        return {
            empleado_id: v.empleado_id,
            fecha: v.fecha,
            hotel_id: h,
            turno: v.turno, 
            tipo: v.tipo, 
            sustituto: v.sustituto || '',
            updated_by: 'MIGRACION_IA_BAJAS',
            updated_at: new Date().toISOString()
        };
    });

    console.log(`📦 Preparados ${normalized.length} registros.`);

    const { error } = await supabase
        .from('turnos')
        .upsert(normalized, { onConflict: 'empleado_id,fecha' });
    
    if (error) {
        console.error(`❌ Error en migración:`, error.message);
    } else {
        console.log(`✅ Migración completada exitosamente.`);
    }

    console.log("🎉 Proceso finalizado.");
}

run();
