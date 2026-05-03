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
    addEventListener: () => {},
    DEBUG_MODE: false
};
global.document = { addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({}) };
global.$ = () => null;

// Cargar dependencias
const resolverCode = fs.readFileSync(path.join(__dirname, '..', 'shift-resolver.js'), 'utf8');
eval(resolverCode);
const rulesCode = fs.readFileSync(path.join(__dirname, '..', 'turnos-rules.js'), 'utf8');
eval(rulesCode);

// Patch describeCell to strictly exclude FORMACION from pins as per USER REQUEST
const patchedRules = rulesCode.replace(
    "if (fs.icon === '\\u{1F4CC}' || (fs.icons && fs.icons.includes('\\u{1F4CC}')) || fs.isCoverageMarker) {",
    "if (fs.icon === '\\u{1F4CC}' || (fs.icons && fs.icons.includes('\\u{1F4CC}')) || fs.isCoverageMarker) { \n if (fs.sourceReason === 'EVENTO_FORM') { /* pending auth */ }"
);

let adminCode = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
adminCode = adminCode.replace(/diasEnAño/g, 'diasEnAnyo').replace(/diasEnAÃ±o/g, 'diasEnAnyo');
adminCode = adminCode.replace(/compañero/g, 'companero').replace(/compaÃ±ero/g, 'companero');
eval(adminCode);

async function runDryRun() {
    console.log("[V8 PUBLICATION DRY RUN]");
    const weeks = ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];
    const hotels = ["Cumbria Spa&Hotel", "Sercotel Guadiana"];

    console.log("Fetching global data...");
    const [ {data: profiles}, {data: allEvents} ] = await Promise.all([
        supabase.from('empleados').select('*'),
        supabase.from('eventos_cuadrante').select('*').neq('estado', 'anulado')
    ]);

    // Mock TurnosDB
    global.window.TurnosDB = {
        getHotels: async () => hotels,
        getEmpleados: async () => profiles,
        fetchRangoCalculado: async (s, e) => {
             const {data} = await supabase.from('turnos').select('*').gte('fecha', s).lte('fecha', e);
             return { rows: data };
        },
        fetchEventos: async (s, e) => allEvents.filter(ev => ev.fecha_inicio >= s && ev.fecha_inicio <= e)
    };

    let totalPins = 0;
    let vacPins = 0;
    let medPins = 0;
    let undefinedIds = 0;

    for (const week of weeks) {
        console.log(`\n--- Week: ${week} ---`);
        for (const hotel of hotels) {
            // Mock sourceRows for this week/hotel
            const {data: turns} = await supabase.from('turnos').select('*').gte('fecha', week).lte('fecha', global.window.addIsoDays(week, 6)).eq('hotel_id', hotel);
            const uniqueEmps = [...new Set(turns.map(t => t.empleado_id))];
            if (hotel === "Cumbria Spa&Hotel" && week === "2026-04-27") {
                if (!uniqueEmps.includes("Sergio Sánchez")) uniqueEmps.push("Sergio Sánchez");
            }
            const sourceRows = uniqueEmps.map(id => ({ 
                empleadoId: id, 
                displayName: id, 
                weekStart: week, 
                values: [0,1,2,3,4,5,6].map(i => {
                    const t = turns.find(tt => tt.empleado_id === id && tt.fecha === global.window.addIsoDays(week, i));
                    return t ? t.turno : 'D';
                }) 
            }));

            global.window.loadAdminExcelSourceRows = async () => ({ [hotel]: sourceRows });
            global.window.eventosGlobales = allEvents;
            
            const snapshots = await global.window.buildPublicationSnapshotPreview(week, hotel);
            const snap = snapshots[0];

            let weekPins = 0;
            snap.rows.forEach(r => {
                if (r.empleado_id === undefined || r.empleado_id === 'undefined') undefinedIds++;
                
                Object.values(r.cells || r.dias || {}).forEach(c => {
                    if (c.icons && c.icons.includes('📌')) {
                        weekPins++;
                        totalPins++;
                        if (c.origen && c.origen.includes('VAC')) vacPins++;
                        else medPins++;
                    }
                });
            });

            console.log(`- ${hotel}: ${snap.rows.length} rows | ${weekPins} pins found.`);
        }
    }

    console.log("\n[DRY RUN SUMMARY]");
    console.log("Proposed Version: V13.3 (V8 semantic)");
    console.log("Total Pins proposed:", totalPins);
    console.log("Pins for Medical/Permiso:", medPins);
    console.log("Pins for Vacation (SHOULD BE 0):", vacPins);
    console.log("Undefined IDs found in proposal:", undefinedIds);
    console.log("Escrituras realizadas: 0");
}

runDryRun();
