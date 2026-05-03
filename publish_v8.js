const fs = require('fs');
const path = require('path');
const { createClient } = require('./temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DEFAULT_VERSION = 141;
const DEFAULT_WEEKS = ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];
const DEFAULT_HOTELS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
const EXECUTE_CONFIRM_TOKEN = 'publish-2025-v141';

// Mock Environment for admin.js
global.window = {
    normalizeId: (id) => String(id || '').trim().toLowerCase(),
    normalizeTipo: (t) => String(t || '').toUpperCase(),
    normalizeEstado: (s) => String(s || '').toLowerCase(),
    addIsoDays: (d, n) => {
        const dt = new Date(d + 'T12:00:00');
        dt.setDate(dt.getDate() + n);
        return dt.toISOString().split('T')[0];
    },
    buildPuestoId: (h, i) => `${h}_P${i}`,
    addEventListener: () => {},
    DEBUG_MODE: false
};
global.document = { addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({}) };

// Load Business Logic
const resolverCode = fs.readFileSync(path.join(__dirname, 'shift-resolver.js'), 'utf8');
eval(resolverCode);
const rulesCode = fs.readFileSync(path.join(__dirname, 'turnos-rules.js'), 'utf8');
eval(rulesCode);

// Mock TurnosDB EARLY to prevent errors in admin.js eval
global.window.TurnosDB = {
    getHotels: async () => [],
    getEmpleados: async () => [],
    fetchRangoCalculado: async () => ({ rows: [] }),
    fetchEventos: async () => []
};

const adminCode = fs.readFileSync(path.join(__dirname, 'admin.js'), 'utf8')
    .replace(/diasEnAño/g, 'diasEnAnyo').replace(/diasEnAÃ±o/g, 'diasEnAnyo')
    .replace(/año/g, 'anyo').replace(/compañero/g, 'companero')
    .replace(/\?\?/g, '||');
eval(adminCode);

// CLI Args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const version = parseInt(args.find(a => a.startsWith('--version='))?.split('=')[1] || String(DEFAULT_VERSION), 10);
const targetWeeks = (args.find(a => a.startsWith('--weeks='))?.split('=')[1] || DEFAULT_WEEKS.join(',')).split(',');
const targetHotels = (args.find(a => a.startsWith('--hotels='))?.split('=')[1] || DEFAULT_HOTELS.join(',')).split(',');
const confirmToken = args.find(a => a.startsWith('--confirm='))?.split('=')[1] || '';
const allowExisting = args.includes('--allow-existing');

async function inspectExistingPublications(versionToPublish, weeks, hotels) {
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version, estado')
        .in('hotel', hotels)
        .in('semana_inicio', weeks)
        .order('semana_inicio', { ascending: true })
        .order('hotel', { ascending: true })
        .order('version', { ascending: false });

    if (error) throw error;

    const summary = new Map();
    let sameVersionCount = 0;

    (data || []).forEach(row => {
        const key = `${row.semana_inicio} | ${row.hotel}`;
        if (!summary.has(key)) summary.set(key, []);
        summary.get(key).push(`V${row.version} (${row.estado})`);
        if (row.version === versionToPublish) sameVersionCount++;
    });

    return { summary, sameVersionCount };
}

async function run() {
    console.log(`\n--- V8 PUBLICATION ENGINE (Version ${version}) ---`);
    console.log(`Mode: ${isExecute ? 'REAL EXECUTION' : 'DRY RUN'}`);
    console.log(`Weeks: ${targetWeeks.join(', ')}`);
    console.log(`Hotels: ${targetHotels.join(', ')}`);

    if (!isDryRun && !isExecute) {
        console.error("Error: Must specify --dry-run or --execute");
        process.exit(1);
    }

    if (Number.isNaN(version) || version <= 0) {
        console.error('Error: --version must be a positive integer.');
        process.exit(1);
    }

    if (isExecute) {
        if (version !== DEFAULT_VERSION) {
            console.error(`Blocked: publish_v8.js only allows live execution with version ${DEFAULT_VERSION}. Received V${version}.`);
            process.exit(1);
        }
        if (confirmToken !== EXECUTE_CONFIRM_TOKEN) {
            console.error(`Blocked: live execution requires --confirm=${EXECUTE_CONFIRM_TOKEN}`);
            process.exit(1);
        }
    }

    console.log("\nFetching global data...");
    const [ {data: profiles}, {data: allEvents} ] = await Promise.all([
        supabase.from('empleados').select('*'),
        supabase.from('eventos_cuadrante').select('*').neq('estado', 'anulado')
    ]);

    const existing = await inspectExistingPublications(version, targetWeeks, targetHotels);
    if (existing.summary.size > 0) {
        console.log('\nExisting publications detected in target scope:');
        existing.summary.forEach((versions, scope) => {
            console.log(`- ${scope}: ${versions.join(', ')}`);
        });
    } else {
        console.log('\nExisting publications detected in target scope: none');
    }

    if (isExecute) {
        if (allowExisting) {
            console.error('\nBlocked: --allow-existing flag is explicitly disabled for V138 safety. Do not use this flag.');
            process.exit(1);
        }
    }

    if (isExecute && existing.sameVersionCount > 0) {
        console.error(`\nBlocked: found ${existing.sameVersionCount} existing snapshot(s) already using version ${version}.`);
        process.exit(1);
    }

    global.window.TurnosDB = {
        getHotels: async () => targetHotels,
        getEmpleados: async () => profiles,
        fetchRangoCalculado: async (s, e) => {
             const {data} = await supabase.from('turnos').select('*').gte('fecha', s).lte('fecha', e);
             return { rows: data };
        },
        fetchEventos: async (s, e) => allEvents.filter(ev => ev.fecha_inicio >= s && ev.fecha_inicio <= e)
    };

    // V139 FIX: Inject v9ExcelOrderMap from JSON so getV9ExcelOrder() returns real Excel V9
    // order values (e.g. Sergio=341, Cristina=342...) in Node.js context.
    // This makes position inheritance (sustituto hereda puestoOrden del titular) identical to Admin Preview.
    try {
        const v9Raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'v9_excel_order_map.json'), 'utf8'));
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
        console.log(`[V9] Loaded ${v9Raw.length} Excel V9 order entries.`);
    } catch(e) {
        console.warn('[V9] Could not load v9_excel_order_map.json — puestoOrden will use fallback.');
    }

    let createdCount = 0;

    for (const week of targetWeeks) {
        for (const hotel of targetHotels) {
            console.log(`\n[SNAPSHOT] Processing ${hotel} | ${week}...`);
            
            // Fetch turns for sourceRows mock
            const {data: turns} = await supabase.from('turnos').select('*').gte('fecha', week).lte('fecha', global.window.addIsoDays(week, 6)).eq('hotel_id', hotel);
            const uniqueEmps = [...new Set(turns.map(t => t.empleado_id))];
            
            // Sergio (Cumbria) Fix for Grid Mock
            if (hotel === "Cumbria Spa&Hotel" && week === "2026-04-27" && !uniqueEmps.includes("Sergio")) {
                uniqueEmps.push("Sergio");
            }

            // ORDER BY EMP-ID (from DB profiles, not hardcoded names)
            // Source: profiles array fetched from empleados table, ordered by DB 'orden' column
            // This replaces the deprecated CUMBRIA_ORDER/GUADIANA_ORDER name-based lists.
            // NOTE: Current DB has no numeric 'orden' column, so ordering is by DB insertion sequence.
            // This is PROVISIONAL — must be replaced when puestoOrden/sortKey is stored per employee.
            const hotelProfiles = profiles
                .filter(p => (p.hotel_id || p.hotel || '') === hotel)
                .map((p, idx) => ({ id: p.id, _dbIdx: idx }));
            const empIdOrderMap = {};
            hotelProfiles.forEach((p, i) => { empIdOrderMap[String(p.id).trim()] = i; });

            uniqueEmps.sort((a, b) => {
                const idxA = empIdOrderMap[String(a).trim()] ?? 9999;
                const idxB = empIdOrderMap[String(b).trim()] ?? 9999;
                if (idxA !== idxB) return idxA - idxB;
                return String(a).localeCompare(String(b));
            });

            // GUARD: Detect Pendiente employees before publishing
            const pendingEmps = uniqueEmps.filter(id => {
                const p = profiles.find(pp => String(pp.id).trim() === String(id).trim());
                return p && (
                    String(p.nombre || '').toLowerCase().includes('pendiente') ||
                    String(p.tipo_personal || '').toLowerCase() === 'placeholder' ||
                    String(p.estado_empresa || p.estado || '').toLowerCase() === 'pendiente'
                );
            });
            if (pendingEmps.length > 0 && !args.includes('--allow-pending-employees')) {
                console.error(`\n[BLOCKED] Empleados Pendiente detectados en ${hotel} | ${week}:`);
                pendingEmps.forEach(id => {
                    const p = profiles.find(pp => String(pp.id).trim() === String(id).trim());
                    console.error(`  - EMP-ID: ${id} | nombre: ${p?.nombre} | tipo: ${p?.tipo_personal} | estado: ${p?.estado_empresa || p?.estado}`);
                });
                console.error('  Re-run with --allow-pending-employees to override (requires explicit authorization).');
                process.exit(1);
            }

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
                console.log(`- Skipping ${hotel} | ${week}: No snapshot generated (likely no data).`);
                continue;
            }
            const snap = snapshots[0];

            // Enrich rows with profile metadata (tipo_personal, excludeCounters)
            // puestoOrden already comes correctly from getEmployees() now that
            // v9ExcelOrderMap is loaded from JSON above.
            snap.rows.forEach((row, idx) => {
                const empId = String(row.empleado_id || row.nombre || '').trim();
                const profile = profiles.find(p =>
                    String(p.id || '').trim() === empId ||
                    String(p.nombre || '').trim() === empId
                );
                if (profile) {
                    row.tipo = row.tipo || profile.tipo_personal || 'fijo';
                    row.tipoPersonal = profile.tipo_personal || 'fijo';
                    row.excludeCounters = (
                        String(profile.tipo_personal || '').toLowerCase().includes('apoyo') ||
                        String(profile.tipo_personal || '').toLowerCase().includes('ocasional')
                    );
                }
                // puestoOrden from getEmployees() is authoritative — do not override.
                // orden is a convenience alias for the snapshot consumer (Index/Mobile).
                row.orden = row.puestoOrden;
            });

            // Re-sort rows by puestoOrden (position inheritance restored):
            // operativos first (by inherited puestoOrden), ausencia_informativa last.
            snap.rows.sort((a, b) => {
                const absA = a.rowType === 'ausencia_informativa';
                const absB = b.rowType === 'ausencia_informativa';
                if (absA !== absB) return absA ? 1 : -1;
                const oA = Number(a.puestoOrden ?? a.orden ?? 9999);
                const oB = Number(b.puestoOrden ?? b.orden ?? 9999);
                if (oA !== oB) return oA - oB;
                // Tiebreaker: fijo before apoyo/ocasional
                const rankA = (a.tipoPersonal === 'fijo') ? 0 : 1;
                const rankB = (b.tipoPersonal === 'fijo') ? 0 : 1;
                return rankA - rankB;
            });

            // Validation Summary
            let pins = 0;
            snap.rows.forEach(r => {
                Object.values(r.cells || r.dias || {}).forEach(c => {
                    if (c.icons && c.icons.includes('📌')) pins++;
                });
            });
            console.log(`- Status: Generated ${snap.rows.length} rows | ${pins} pins found.`);

            if (isExecute) {
                const weekEnd = global.window.addIsoDays(week, 6);
                const { error } = await supabase.from('publicaciones_cuadrante').insert({
                    hotel: hotel,
                    semana_inicio: week,
                    semana_fin: weekEnd,
                    version: version,
                    estado: 'activo',
                    snapshot_json: snap,
                    publicado_por: 'Antigravity V133 Engine'
                });
                if (error) console.error(`- Error inserting:`, error);
                else {
                    console.log(`- Success: Inserted version ${version}.`);
                    createdCount++;
                }
            } else {
                console.log(`- Dry Run: Would insert version ${version}.`);
                createdCount++;
            }
        }
    }

    console.log(`\n--- FINAL SUMMARY ---`);
    console.log(`Total snapshots processed: ${createdCount}`);
    console.log(`Escrituras realizadas: ${isExecute ? createdCount : 0}`);
    if (isExecute) {
        console.log(`Confirm token accepted: ${EXECUTE_CONFIRM_TOKEN}`);
    }
}

run();
