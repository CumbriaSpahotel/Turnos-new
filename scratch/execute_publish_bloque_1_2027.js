const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mock Environment for admin.js / supabase-dao.js
global.window = {
    supabase: supabase, // DAO needs this
    normalizeId: (id) => String(id || '').trim().toLowerCase(),
    normalizeTipo: (t) => String(t || '').toUpperCase(),
    normalizeEstado: (s) => String(s || '').toLowerCase(),
    normalizeDate: (d) => String(d || '').split('T')[0],
    isoDate: (d) => {
        if (!d) return '';
        const dt = new Date(d);
        return dt.toISOString().split('T')[0];
    },
    getMonday: (d) => {
        const dt = new Date(d);
        const day = dt.getDay();
        const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(dt.setDate(diff));
    },
    addIsoDays: (d, n) => {
        const dt = new Date(d + 'T12:00:00');
        dt.setDate(dt.getDate() + n);
        return dt.toISOString().split('T')[0];
    },
    buildPuestoId: (h, i) => `${h}_P${i}`,
    addEventListener: () => {},
    DEBUG_MODE: false,
    reportOperationalDiagnostic: (diag) => {
        console.log(`[DIAGNOSTIC] ${diag.type}: ${diag.title} - ${diag.desc}`);
    }
};
global.document = { addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({}) };

// Load DAO
const daoCode = fs.readFileSync(path.join(__dirname, '..', 'supabase-dao.js'), 'utf8');
eval(daoCode);
const dao = window.TurnosDB;
global.window.TurnosDB = dao;


// Load Business Logic
const resolverCode = fs.readFileSync(path.join(__dirname, '..', 'shift-resolver.js'), 'utf8');
eval(resolverCode);
const rulesCode = fs.readFileSync(path.join(__dirname, '..', 'turnos-rules.js'), 'utf8');
eval(rulesCode);

const adminCode = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8')
    .replace(/diasEnAño/g, 'diasEnAnyo')
    .replace(/año/g, 'anyo')
    .replace(/compañero/g, 'companero')
    .replace(/\?\?\?/g, '|||') // Simple fix for some potential parsing issues in eval
    .replace(/\?\?/g, '||');
eval(adminCode);


const targetWeeks = ['2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25'];
const targetHotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

async function run() {
    console.log("--- BLOQUE 1 2027 PUBLICATION START ---");

    const [ {data: profiles}, {data: allEvents} ] = await Promise.all([
        supabase.from('empleados').select('*'),
        supabase.from('eventos_cuadrante').select('*').neq('estado', 'anulado')
    ]);

    global.window.TurnosDB = {
        ...dao,
        getHotels: async () => targetHotels,
        getEmpleados: async () => profiles,
        fetchRangoCalculado: async (s, e) => {
             const {data} = await supabase.from('turnos').select('*').gte('fecha', s).lte('fecha', e);
             return { rows: data };
        },
        fetchEventos: async (s, e) => allEvents.filter(ev => ev.fecha_inicio >= s && ev.fecha_inicio <= e),
        getV9ExcelOrder: () => null // Simplified
    };

    // Load V9 Map
    try {
        const v9Raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'v9_excel_order_map.json'), 'utf8'));
        const v9Index = {};
        const normalizeV9Key = (s) => String(s || '').toLowerCase().trim();
        v9Raw.forEach(item => {
            const h = normalizeV9Key(item.hotel);
            const w = item.week_start;
            const e = normalizeV9Key(item.empleado_id);
            if (!v9Index[h]) v9Index[h] = {};
            if (!v9Index[h][w]) v9Index[h][w] = {};
            v9Index[h][w][e] = item;
        });
        global.window.v9ExcelOrderMap = v9Index;
        global.window.normalizeV9Key = normalizeV9Key;
    } catch(e) {}

    const results = [];

    for (const week of targetWeeks) {
        for (const hotel of targetHotels) {
            console.log(`\nProcessing ${hotel} | ${week}...`);
            
            const {data: turns} = await supabase.from('turnos').select('*').gte('fecha', week).lte('fecha', global.window.addIsoDays(week, 6)).eq('hotel_id', hotel);
            const uniqueEmps = [...new Set(turns.map(t => t.empleado_id))];
            
            const sourceRows = uniqueEmps.map(id => ({ 
                empleadoId: id, 
                displayName: id, 
                weekStart: week, 
                values: [0,1,2,3,4,5,6].map(i => {
                    const t = turns.find(tt => tt.empleado_id === id && tt.fecha === global.window.addIsoDays(week, i));
                    return t ? t.turno : '—';
                }) 
            }));

            global.window.loadAdminExcelSourceRows = async () => ({ [hotel]: sourceRows });
            global.window.eventosGlobales = allEvents;
            
            const snapshots = await global.window.buildPublicationSnapshotPreview(week, hotel);
            if (!snapshots || snapshots.length === 0) {
                console.log(`- Skipping: No snapshot generated.`);
                continue;
            }
            const snap = snapshots[0];

            // Use the DAO to publish
            const pubResult = await dao.publishCuadranteSnapshot({
                semanaInicio: week,
                semanaFin: global.window.addIsoDays(week, 6),
                hotel: hotel,
                snapshot: snap,
                resumen: { emps: snap.rows.length },
                usuario: 'Antigravity Bloque 1 Engine'
            });

            console.log(`- Success! Result:`, {
                success: pubResult.success,
                version: pubResult.publication.version,
                needsManualCleanup: pubResult.needsManualCleanup,
                warning: pubResult.warning
            });

            results.push({
                hotel,
                week,
                version: pubResult.publication.version,
                needsManualCleanup: pubResult.needsManualCleanup
            });
        }
    }

    console.log("\n--- PUBLICATION SUMMARY ---");
    console.table(results);
}

run().catch(err => {
    console.error("CRITICAL ERROR:", err);
});
