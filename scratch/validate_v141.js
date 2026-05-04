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

async function dryRunValidation() {
    const hotel = "Sercotel Guadiana";
    const week = "2026-06-01";
    const date = "2026-06-05"; // Friday (Swap day)
    
    console.log(`\n--- V141 DRY-RUN VALIDATION: ${hotel} | ${week} ---`);
    
    const [ {data: profiles}, {data: allEvents}, {data: turns} ] = await Promise.all([
        supabase.from('empleados').select('*'),
        supabase.from('eventos_cuadrante').select('*').neq('estado', 'anulado'),
        supabase.from('turnos').select('*').gte('fecha', week).lte('fecha', window.addIsoDays(week, 6)).eq('hotel_id', hotel)
    ]);
    
    const uniqueEmps = [...new Set(turns.map(t => t.empleado_id))];
    if (!uniqueEmps.includes('¿?')) uniqueEmps.push('¿?');

    const sourceRows = uniqueEmps.map(id => ({ 
        empleadoId: id, 
        displayName: id, 
        weekStart: week, 
        values: [0,1,2,3,4,5,6].map(i => {
            const t = turns.find(tt => tt.empleado_id === id && tt.fecha === window.addIsoDays(week, i));
            return t ? t.turno : '—';
        }),
        rowIndex: 0
    }));

    global.window.TurnosDB = {
        getHotels: async () => [hotel],
        getEmpleados: async () => profiles,
        fetchRangoCalculado: async () => ({ rows: turns }),
        fetchEventos: async () => allEvents
    };
    global.window.loadAdminExcelSourceRows = async () => ({ [hotel]: sourceRows });
    global.window.eventosGlobales = allEvents;

    const snapshots = await global.window.buildPublicationSnapshotPreview(week, hotel);
    const snap = snapshots[0];
    const rows = snap.rows;
    
    console.log(`\nTotal rows generated: ${rows.length}`);
    
    const diana = rows.find(r => String(r.nombreVisible || r.nombre).includes('Diana'));
    const daniAbsent = rows.find(r => String(r.nombreVisible || r.nombre).includes('Dani') && r.rowType === 'ausente_info');
    const sinAsignar = rows.find(r => String(r.nombreVisible || r.nombre).includes('sin asignar'));
    
    console.log('\n--- Row Model Validation ---');
    if (diana) {
        console.log('Diana (Operational):', {
            rowType: diana.rowType,
            puestoOrden: diana.puestoOrden,
            puestoOrdenOriginal: diana.puestoOrdenOriginal,
            titularOriginal: diana.titularOriginal,
            ocupanteVisible: diana.ocupanteVisible,
            hasTurnosOperativos: !!diana.turnosOperativos,
            fridayShift: diana.turnosOperativos[date].label
        });
    }
    
    if (daniAbsent) {
        console.log('Dani (Absent):', {
            rowType: daniAbsent.rowType,
            puestoOrden: daniAbsent.puestoOrden,
            puestoOrdenOriginal: daniAbsent.puestoOrdenOriginal,
            titularOriginal: daniAbsent.titularOriginal,
            ocupanteVisible: daniAbsent.ocupanteVisible,
            incidenciaTitular: daniAbsent.incidenciaTitular
        });
    }

    if (sinAsignar) {
        console.log('sin asignar (Operational):', {
            rowType: sinAsignar.rowType,
            titularOriginal: sinAsignar.titularOriginal,
            fridayShift: sinAsignar.turnosOperativos[date].label
        });
    }

    // Check for duplicates
    const names = rows.map(r => r.nombreVisible);
    const uniqueNames = new Set(names);
    console.log(`\nDuplicates check: ${names.length === uniqueNames.size ? 'PASSED' : 'FAILED (' + (names.length - uniqueNames.size) + ' duplicates)'}`);
    
    // Check for EMP-XXXX / UUID
    const hasIds = rows.some(r => /EMP-|\b[0-9a-f]{8}-/.test(r.nombreVisible));
    console.log(`ID Leak check: ${!hasIds ? 'PASSED' : 'FAILED'}`);
}

dryRunValidation();
