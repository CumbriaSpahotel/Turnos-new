const fs = require('fs');
const path = require('path');
const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mock de window y dependencias para admin.js
global.window = {
    normalizeId: (id) => String(id || '').trim().toLowerCase(),
    normalizeTipo: (t) => String(t || '').toUpperCase(),
    normalizeEstado: (s) => String(s || '').toLowerCase(),
    normalizeDate: (d) => d,
    addIsoDays: (d, n) => {
        const dt = new Date(d + 'T12:00:00');
        dt.setDate(dt.getDate() + n);
        return dt.toISOString().split('T')[0];
    },
    getMonday: (d) => {
        const day = d.getDay() || 7;
        const res = new Date(d);
        res.setDate(d.getDate() - day + 1);
        return res;
    },
    isoDate: (d) => d.toISOString().split('T')[0],
    getV9ExcelOrder: () => 500,
    buildPuestoId: (h, i) => `${h}_P${i}`,
    TurnosDB: {
        getHotels: async () => ["Cumbria Spa&Hotel", "Sercotel Guadiana"],
        getEmpleados: async () => profiles,
        fetchRangoCalculado: async (s, e) => ({ rows: turns }),
        fetchEventos: async (s, e) => events
    },
    getDisplayName: (id) => id,
    addEventListener: () => {},
    DEBUG_MODE: false
};

global.document = {
    addEventListener: () => {},
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({})
};
global.$ = () => null;

// Cargar dependencias de TurnosWeb
const resolverCode = fs.readFileSync(path.join(__dirname, '..', 'shift-resolver.js'), 'utf8');
eval(resolverCode);
const rulesCode = fs.readFileSync(path.join(__dirname, '..', 'turnos-rules.js'), 'utf8');
eval(rulesCode);
const adminCode = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8')
    .replace('// 2. PROCESAR FILAS EXCEL', 'console.log("[DEBUG] weekStatus Keys:", Array.from(weekStatus.keys()).filter(k => String(k).includes("Sergio"))); // 2. PROCESAR FILAS EXCEL');
eval(adminCode);

async function dryRun() {
    console.log("--- DRY RUN PUBLICATION V8 (CUMBRIA MAY) ---");
    const hotel = "Cumbria Spa&Hotel";
    const weekStart = "2026-05-04";
    const weekEnd = global.window.addIsoDays(weekStart, 6);
    const dates = [0,1,2,3,4,5,6].map(i => global.window.addIsoDays(weekStart, i));

    // 1. Fetch real data
    console.log("Fetching data from Supabase...");
    let [ {data: profiles}, {data: events}, {data: turns} ] = await Promise.all([
        supabase.from('empleados').select('*'),
        supabase.from('eventos_cuadrante').select('*').neq('estado', 'anulado'),
        supabase.from('turnos').select('*').gte('fecha', weekStart).lte('fecha', weekEnd)
    ]);

    // Enforce canonical ID for Sergio to ensure matching
    profiles = profiles.map(p => {
        if (p.nombre.includes('Sergio')) return { ...p, id: 'EMP-SERGIO', nombre: 'Sergio Sánchez' };
        if (p.nombre.includes('Miriam')) return { ...p, id: 'EMP-MIRIAM', nombre: 'Miriam' };
        return p;
    });
    events = events.map(e => {
        if (e.empleado_id === 'Sergio' || e.empleado_id === 'Sergio Sánchez') return { ...e, empleado_id: 'EMP-SERGIO', empleado_destino_id: 'EMP-MIRIAM' };
        return e;
    });
    turns = turns.map(t => {
        if (t.empleado_id === 'Sergio' || t.empleado_id === 'Sergio Sánchez') return { ...t, empleado_id: 'EMP-SERGIO' };
        return t;
    });

    // Mock de window y dependencias para admin.js
    global.window = {
        ...global.window,
        TurnosDB: {
            getHotels: async () => ["Cumbria Spa&Hotel", "Sercotel Guadiana"],
            getEmpleados: async () => profiles,
            fetchRangoCalculado: async (s, e) => ({ rows: turns }),
            fetchEventos: async (s, e) => events,
            fetchRango: async (s, e) => turns
        }
    };

    // 2. Mock sourceRows (Normalmente vienen del Excel, simulamos con IDs conocidos)
    const sourceRows = [
        { empleadoId: 'EMP-SERGIO', displayName: 'Sergio Sánchez', weekStart },
        { empleadoId: 'Esther', displayName: 'Esther', weekStart },
        { empleadoId: 'Cristina', displayName: 'Cristina', weekStart },
        { empleadoId: 'Valentín', displayName: 'Valentín', weekStart },
        { empleadoId: 'Isabel Hidalgo', displayName: 'Isabel Hidalgo', weekStart },
        { empleadoId: 'EMP-MIRIAM', displayName: 'Miriam', weekStart }
    ].map(r => ({ ...r, values: dates.map(d => {
        const t = turns.find(tt => tt.empleado_id === r.empleadoId && tt.fecha === d);
        return t ? t.turno : 'D';
    }) }));

    // 3. Build Publication Snapshot
    console.log("Building Publication Snapshot...");
    
    const sergioEvents = events.filter(e => e.empleado_id === 'Sergio Sánchez' || e.empleado_id === 'Sergio');
    console.log(`Events for Sergio: ${sergioEvents.length}`);
    sergioEvents.forEach(e => {
        const evH = global.window.getEventoHotel(e);
        const match = global.window.eventoPerteneceAHotel(e, hotel);
        console.log(`- ${e.fecha_inicio}: ${e.tipo} | Hotel: "${evH}" | Match: ${match}`);
    });
    
    // Simular que estamos viendo Cumbria en Vista Previa para que use el cache o cargue datos
    global.window._previewDate = weekStart;
    global.window.loadAdminExcelSourceRows = async () => ({ [hotel]: sourceRows });
    global.window.eventosGlobales = events;
    
    const snapshots = await global.window.buildPublicationSnapshotPreview(weekStart, hotel);
    const snap = snapshots[0];
    console.log(`Snapshot for ${snap.hotel_nombre} generated with ${snap.rows.length} rows.`);

    // 4. Audit Natalio (Substitute) and Sergio (Titular)
    const miriamRow = snap.rows.find(e => e.nombre.includes('Miriam'));
    const sergioRow = snap.rows.find(e => e.nombre.includes('Sergio'));

    if (sergioRow) {
        console.log(`\nSergio Row Found: Type=${sergioRow.rowType}, ID=${sergioRow.empleado_id}`);
        const days = sergioRow.cells || sergioRow.dias;
        const cell04 = days['2026-05-04'];
        console.log(`Sergio May 04: Code=${cell04.code}, Type=${cell04.type}, Icons=${JSON.stringify(cell04.icons)}`);
    }

    if (miriamRow) {
        console.log(`\nMiriam Row Found: Type=${miriamRow.rowType}, ID=${miriamRow.empleado_id}`);
        const days = miriamRow.cells || miriamRow.dias;
        const cell04 = days['2026-05-04'];
        console.log(`Miriam May 04: Code=${cell04.code}, Type=${cell04.type}, Icons=${JSON.stringify(cell04.icons)}`);
        
        if (cell04.icons && cell04.icons.includes('📌')) {
            console.log("❌ ERROR: PIN FOUND FOR MIRIAM (VAC)!");
        } else {
            console.log("✅ SUCCESS: NO PIN FOUND FOR MIRIAM (VAC).");
        }
    } else {
        console.log("\n❌ Miriam not found in rows.");
    }
}

dryRun();
