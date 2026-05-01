const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

// Mock window for ShiftResolver
global.window = {
    normalizeId: (val) => String(val || '').toLowerCase().trim(),
    normalizeDate: (val) => val,
    normalizeTipo: (v) => v,
    normalizeEstado: (v) => v === 'anulado' ? 'anulado' : 'activo',
    eventoAplicaEnFecha: (ev, f) => f >= ev.fecha_inicio && f <= ev.fecha_fin,
    getEventoHotel: (ev) => ev.hotel_id || ev.hotel_origen,
    eventoPerteneceAHotel: () => true,
    isValidShiftValue: (v) => ["M", "T", "N", "D"].includes(v),
    isInvalidLegacyChangeValue: (v) => v === 'CT',
    getTurnoBaseDeEmpleado: (id, date, index) => index.get(`${id}_${date}`),
    DEBUG_MODE: true
};

// Re-implement or load ShiftResolver logic (partial)
function getTurnoOperativoBase(empId, date, context) {
    const events = context.eventos;
    const baseIndex = context.baseIndex;
    
    const subEvent = events.find(ev => {
        if (date < ev.fecha_inicio || date > ev.fecha_fin) return false;
        if (ev.tipo !== 'VAC' && ev.tipo !== 'SUSTITUCION') return false;
        return ev.empleado_destino_id === empId;
    });

    if (subEvent) {
        const titularId = ev.empleado_id;
        return baseIndex.get(`${titularId}_${date}`);
    }
    return baseIndex.get(`${empId}_${date}`);
}

// I'll just load the actual file content and eval it if possible, but it's easier to just trace the logic.

async function simulate() {
    const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const date = '2026-04-15';
    const hotel = 'Cumbria Spa&Hotel';

    const { data: events } = await supabase.from('eventos_cuadrante').select('*').gte('fecha_inicio', date).lte('fecha_inicio', date);
    const { data: turnos } = await supabase.from('turnos').select('*').eq('fecha', date);

    const baseIndex = new Map();
    turnos.forEach(t => baseIndex.set(t.empleado_id.toLowerCase().trim(), t.turno));

    console.log("--- SIMULACION CUMBRIA 15/04/26 ---");
    const targets = ['cristina', 'miriam', 'esther'];
    
    targets.forEach(name => {
        console.log(`\nResolviendo ${name}:`);
        const base = baseIndex.get(name) || '—';
        console.log(`  Base: ${base}`);
        
        const activeEvents = events.filter(ev => {
            const tId = String(ev.empleado_id || '').toLowerCase().trim();
            const dId = String(ev.empleado_destino_id || '').toLowerCase().trim();
            return tId === name || dId === name;
        });

        activeEvents.forEach(ev => {
            console.log(`  Evento: ${ev.tipo} | ${ev.empleado_id} -> ${ev.empleado_destino_id} | Orig: ${ev.turno_original} | Nuevo: ${ev.turno_nuevo}`);
        });
    });
}

simulate();
