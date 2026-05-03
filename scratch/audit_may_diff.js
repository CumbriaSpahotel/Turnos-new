const fs = require('fs');
const path = require('path');
const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mock Environment for admin.js / turnos-rules.js
global.window = {
    normalizeId: (id) => String(id || '').trim().toLowerCase(),
    normalizeTipo: (t) => String(t || '').toUpperCase(),
    normalizeEstado: (s) => String(s || '').toLowerCase(),
    normalizeV9Key: (s) => String(s || '').trim().toLowerCase(), // Simple mock
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

// Load Logic
const resolverCode = fs.readFileSync(path.join(__dirname, '../shift-resolver.js'), 'utf8');
eval(resolverCode);
const rulesCode = fs.readFileSync(path.join(__dirname, '../turnos-rules.js'), 'utf8');
eval(rulesCode);

// Mock TurnosDB EARLY to prevent errors in admin.js eval
global.window.TurnosDB = {
    getHotels: async () => [],
    getEmpleados: async () => [],
    fetchRangoCalculado: async () => ({ rows: [] }),
    fetchEventos: async () => []
};

const adminCode = fs.readFileSync(path.join(__dirname, '../admin.js'), 'utf8')
    .replace(/diasEnAño/g, 'diasEnAnyo').replace(/diasEnAÃ±o/g, 'diasEnAnyo')
    .replace(/año/g, 'anyo').replace(/compañero/g, 'companero')
    .replace(/\?\?/g, '||');
eval(adminCode);

async function runAudit() {
    console.log("[POST-EVENT-FIX MAYO DIFF DRY RUN]");
    
    const weeks = ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];
    const hotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    
    // 1. Fetch current published snapshots (Highest version per scope)
    const { data: allActiveSnaps } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .in('semana_inicio', weeks)
        .in('hotel', hotels)
        .eq('estado', 'activo')
        .order('version', { ascending: false });

    // 2. Fetch fresh operational data
    const [ {data: profiles}, {data: allEvents}, {data: allTurns} ] = await Promise.all([
        supabase.from('empleados').select('*'),
        supabase.from('eventos_cuadrante').select('*').neq('estado', 'anulado'),
        supabase.from('turnos').select('*').gte('fecha', '2026-04-27').lte('fecha', '2026-06-07')
    ]);

    global.window.TurnosDB = {
        getHotels: async () => hotels,
        getEmpleados: async () => profiles,
        fetchRangoCalculado: async (s, e) => {
             const rows = allTurns.filter(t => t.fecha >= s && t.fecha <= e);
             return { rows };
        },
        fetchEventos: async (s, e) => allEvents.filter(ev => ev.fecha_inicio >= s && ev.fecha_inicio <= e)
    };

    // Load admin.js parts for building snapshot (mocked)
    // We'll use a simplified version of the logic in publish_v8.js
    
    for (const week of weeks) {
        for (const hotel of hotels) {
            console.log(`\n--- Week: ${week} | Hotel: ${hotel} ---`);
            
            const current = allActiveSnaps.find(s => s.semana_inicio === week && s.hotel === hotel);
            if (!current) {
                console.log("No published snapshot found for this scope.");
                continue;
            }
            console.log(`Current DB Version: ${current.version} (Created: ${current.created_at})`);

            // Generate "Next" snapshot
            const turns = allTurns.filter(t => t.fecha >= week && t.fecha <= global.window.addIsoDays(week, 6) && t.hotel_id === hotel);
            const uniqueEmps = [...new Set(turns.map(t => t.empleado_id))].filter(id => id && id !== 'undefined' && String(id).trim() !== '');
            
            // Sergio Cumbria Fix
            if (hotel === "Cumbria Spa&Hotel" && week === "2026-04-27" && !uniqueEmps.includes("Sergio")) {
                uniqueEmps.push("Sergio");
            }

            const sourceRows = uniqueEmps.map((id, idx) => ({ 
                empleadoId: id, 
                displayName: id, 
                rowIndex: idx,
                weekStart: week, 
                values: [0,1,2,3,4,5,6].map(i => {
                    const t = turns.find(tt => tt.empleado_id === id && tt.fecha === global.window.addIsoDays(week, i));
                    return t ? t.turno : 'D';
                }) 
            }));

            // Simplified Mock of buildPublicationSnapshotPreview
            // We'll use the actual TurnosEngine/ShiftResolver if possible
            const dates = [0,1,2,3,4,5,6].map(i => global.window.addIsoDays(week, i));
            const previewModel = global.window.createPuestosPreviewModel({
                hotel,
                dates,
                sourceRows,
                rows: turns,
                eventos: allEvents,
                employees: profiles
            });

            const nextRows = previewModel.getEmployees().map(p => {
                const empId = p.employee_id;
                const days = {};
                dates.forEach(d => {
                    const res = previewModel.getTurnoEmpleado(empId, d);
                    const visual = global.window.TurnosRules.describeCell(res);
                    days[d] = { label: visual.label, icons: visual.icons || [] };
                });
                return { empId, days };
            });

            // Compare with current
            const currentSnap = current.snapshot_json || {};
            const currentRows = (currentSnap.empleados || currentSnap.rows || []).map(r => ({
                empId: r.empleado_id || r.nombre || r.empId,
                days: r.dias || r.cells || {}
            }));

            let diffCount = 0;
            const affectedEmps = [];

            nextRows.forEach(nextRow => {
                if (nextRow.empId === 'Natalio') {
                    console.log(`[NATALIO_DEBUG] Day 2026-04-28: label=${nextRow.days['2026-04-28'].label}, icons=${nextRow.days['2026-04-28'].icons.join(',')}`);
                }
                const currRow = currentRows.find(r => r.empId === nextRow.empId);
                if (!currRow) {
                    console.log(`[DIFF] New Employee in Grid: ${nextRow.empId}`);
                    diffCount++;
                    affectedEmps.push(nextRow.empId);
                    return;
                }

                dates.forEach(d => {
                    const nCell = nextRow.days[d];
                    const cCell = currRow.days[d];
                    
                    const nLabel = nCell.label;
                    const cLabel = cCell.label || cCell.code;
                    const nIcons = nCell.icons.join(',');
                    const cIcons = (cCell.icons || []).join(',');

                    if (nLabel !== cLabel || nIcons !== cIcons) {
                        console.log(`[DIFF] ${nextRow.empId} @ ${d}: [${cLabel}](${cIcons}) -> [${nLabel}](${nIcons})`);
                        diffCount++;
                        if (!affectedEmps.includes(nextRow.empId)) affectedEmps.push(nextRow.empId);
                    }
                });
            });

            if (diffCount === 0) {
                console.log("Result: NO DIFFERENCES detected.");
            } else {
                console.log(`Result: ${diffCount} differences found in ${affectedEmps.length} employees.`);
            }
        }
    }
}

runAudit();
