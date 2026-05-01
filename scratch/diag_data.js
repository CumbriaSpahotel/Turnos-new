const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diag() {
    console.log("--- DIAGNOSTICO EVENTOS CUADRANTE ---");
    const { data: events, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .gte('fecha_inicio', '2026-04-01')
        .lte('fecha_inicio', '2026-04-30');

    if (error) {
        console.error("Error fetching events:", error);
        return;
    }

    console.log(`Encontrados ${events.length} eventos en Abril 2026.`);
    events.forEach(ev => {
        const hotel = ev.hotel_origen || ev.hotel_destino || ev.hotel || '';
        if (hotel.includes('Guadiana')) {
            console.log(`[GUADIANA] ${ev.fecha_inicio} | ${ev.tipo} | ${ev.empleado_id} -> ${ev.empleado_destino_id} | Orig: ${ev.turno_original} | Nuevo: ${ev.turno_nuevo} | Estado: ${ev.estado}`);
        }
        if (hotel.includes('Cumbria')) {
            console.log(`[CUMBRIA] ${ev.fecha_inicio} | ${ev.tipo} | ${ev.empleado_id} -> ${ev.empleado_destino_id} | Orig: ${ev.turno_original} | Nuevo: ${ev.turno_nuevo} | Estado: ${ev.estado}`);
        }
    });

    console.log("\n--- DIAGNOSTICO TURNOS (BASE) ---");
    const { data: turnos, errorT } = await supabase
        .from('turnos')
        .select('*')
        .gte('fecha', '2026-04-01')
        .lte('fecha', '2026-04-30');

    if (errorT) {
        console.error("Error fetching turnos:", errorT);
        return;
    }

    const targets = ['Dani', 'Diana', 'Macarena', 'Cristina', 'Miriam', 'Esther'];
    turnos.forEach(t => {
        const match = targets.some(name => t.empleado_id?.includes(name));
        if (match) {
            console.log(`[TURNO] ${t.fecha} | ${t.empleado_id} | Turno: ${t.turno} | Tipo: ${t.tipo} | Hotel: ${t.hotel_id}`);
        }
    });
}

diag();
