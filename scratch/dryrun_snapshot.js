const fs = require('fs');
const path = require('path');

// Mock Environment for admin.js (Copied from publish_v8.js)
global.window = {
    normalizeId: (id) => String(id || '').trim().toLowerCase(),
    normalizeTipo: (t) => String(t || '').toUpperCase(),
    normalizeEstado: (s) => String(s || '').toLowerCase(),
    normalizeDate: (d) => String(d || '').split('T')[0],
    addIsoDays: (d, n) => {
        const dt = new Date(d + 'T12:00:00');
        dt.setDate(dt.getDate() + n);
        return dt.toISOString().split('T')[0];
    },
    eventoAplicaEnFecha: (ev, d) => {
        const fi = String(ev.fecha_inicio || '').split('T')[0];
        const ff = String(ev.fecha_fin || ev.fecha_inicio || '').split('T')[0];
        return d >= fi && d <= ff;
    },
    eventoPerteneceAHotel: (ev, h) => {
        const hId = String(ev.hotel_id || ev.hotel || '').toLowerCase();
        const target = String(h || '').toLowerCase();
        return hId.includes(target) || target.includes(hId);
    },
    eventoPerteneceAEmpleado: (ev, id, ctx) => {
        const eId = String(ev.empleado_id || ev.titular_id || ev.participante_a || '').toLowerCase().trim();
        const dId = String(ev.empleado_destino_id || ev.sustituto_id || ev.participante_b || '').toLowerCase().trim();
        const target = String(id || '').toLowerCase().trim();
        return eId === target || dId === target;
    },
    isTitularOfAbsence: (ev, id) => {
        const eId = String(ev.empleado_id || ev.titular_id || '').toLowerCase().trim();
        const target = String(id || '').toLowerCase().trim();
        return eId === target;
    },
    getOtroEmpleadoDelCambio: (ev, id) => {
        const eId = String(ev.empleado_id || ev.titular_id || ev.participante_a || '').toLowerCase().trim();
        const dId = String(ev.empleado_destino_id || ev.sustituto_id || ev.participante_b || '').toLowerCase().trim();
        const target = String(id || '').toLowerCase().trim();
        return eId === target ? dId : eId;
    },
    buildPuestoId: (h, i) => `${h}_P${i}`,
    addEventListener: () => {},
    DEBUG_MODE: false
};
global.document = { addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({}) };

const resolverCode = fs.readFileSync(path.join(__dirname, '..', 'shift-resolver.js'), 'utf8');
eval(resolverCode);
const adminCode = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8')
    .replace(/diasEnAño/g, 'diasEnAnyo').replace(/diasEnAÃ±o/g, 'diasEnAnyo')
    .replace(/año/g, 'anyo').replace(/compañero/g, 'companero')
    .replace(/\?\?/g, '||');
eval(adminCode);

const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function dryRunWeek() {
    const hotel = "Sercotel Guadiana";
    const week = "2026-06-01";
    const date = "2026-06-05"; // Friday (The one with the swap)
    
    console.log(`Dry-run generation for ${hotel} | ${week} on ${date}...`);
    
    const [ {data: profiles}, {data: allEvents}, {data: turns} ] = await Promise.all([
        supabase.from('empleados').select('*'),
        supabase.from('eventos_cuadrante').select('*').neq('estado', 'anulado'),
        supabase.from('turnos').select('*').gte('fecha', week).lte('fecha', window.addIsoDays(week, 6)).eq('hotel_id', hotel)
    ]);
    
    const uniqueEmps = [...new Set(turns.map(t => t.empleado_id))];
    // Add sin asignar (¿?) to uniqueEmps if missing
    if (!uniqueEmps.includes('¿?')) uniqueEmps.push('¿?');

    const sourceRows = uniqueEmps.map(id => ({ 
        empleadoId: id, 
        displayName: id, 
        weekStart: week, 
        values: [0,1,2,3,4,5,6].map(i => {
            const t = turns.find(tt => tt.empleado_id === id && tt.fecha === window.addIsoDays(week, i));
            return t ? t.turno : '—';
        }),
        rowIndex: 0 // Mock
    }));

    global.window.TurnosDB = {
        getHotels: async () => [hotel],
        getEmpleados: async () => profiles,
        fetchRangoCalculado: async () => ({ rows: turns }),
        fetchEventos: async () => allEvents
    };
    global.window.loadAdminExcelSourceRows = async () => ({ [hotel]: sourceRows });
    global.window.eventosGlobales = allEvents;

    const snap = await global.window.buildPublicationSnapshotPreview(week, hotel);
    const rows = snap[0].rows;
    
    console.log(`\nDry-run Results (Total rows: ${rows.length}):`);
    const diana = rows.find(r => String(r.nombreVisible || r.nombre).includes('Diana'));
    const daniInformative = rows.find(r => String(r.nombreVisible || r.nombre).includes('Dani') && r.rowType === 'ausencia_informativa');
    const sinAsignar = rows.find(r => String(r.nombreVisible || r.nombre).includes('sin asignar'));
    
    if (diana) console.log(`- Diana: rowType=${diana.rowType}, shift=${JSON.stringify(diana.cells[date])}`);
    if (daniInformative) console.log(`- Dani (Absent): rowType=${daniInformative.rowType}, shift=${JSON.stringify(daniInformative.cells[date])}`);
    if (sinAsignar) console.log(`- sin asignar: rowType=${sinAsignar.rowType}, shift=${JSON.stringify(sinAsignar.cells[date])}`);
    
    if (diana && diana.cells[date].intercambio) {
        console.log('\nSUCCESS: Diana has the exchange operative correctly.');
    } else if (sinAsignar && sinAsignar.cells[date].intercambio) {
        console.log('\nSUCCESS: sin asignar has the exchange operative correctly.');
    } else {
        console.log('\nFAILURE: Neither Diana nor sin asignar have the exchange operative.');
    }
}

dryRunWeek();
