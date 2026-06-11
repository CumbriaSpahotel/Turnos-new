const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Mock window and document
global.window = {
    supabase: null,
    localforage: { getItem: async()=>null, setItem: async()=>{}, removeItem: async()=>{}, clear: async()=>{} },
    addEventListener: ()=>{}
};
global.document = {
    getElementById: ()=>({ textContent:'', style:{}, innerHTML:'', value:'' }),
    querySelector: ()=>({ textContent:'', style:{}, innerHTML:'', value:'' }),
    querySelectorAll: ()=>[],
    addEventListener: ()=>{}
};
global.$ = () => ({ innerHTML: '', classList: { remove:()=>{} }, addEventListener: ()=>{} });

// Read config and initialize Supabase
const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
global.window.supabase = supabase;
global.window.TurnosDB = { client: supabase };

// Load application scripts
global.window.normalizeId = (val) => String(val||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
global.window.isoDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth()+1).padStart(2,'0');
        const d = String(value.getDate()).padStart(2,'0');
        return `${y}-${m}-${d}`;
    }
    return String(value).slice(0,10);
};

const originalFetch = global.fetch;
global.fetch = function (url, options) {
    if (typeof url === 'string' && url.includes('V.9-Turnos.xlsx')) {
        const buffer = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/V.9-Turnos.xlsx');
        return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(buffer)
        });
    }
    return originalFetch(url, options);
};
global.XLSX = require('xlsx');

require('c:/Users/comun/Documents/GitHub/Turnos-new/excel-loader.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/shift-resolver.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/turnos-engine.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-dao.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/admin.js');

async function run() {
    await global.window.populateEmployees();
    const emps = global.window.empleadosGlobales || [];

    const sandra = emps.find(e => e.nombre.includes('Sandra'));
    const natalio = emps.find(e => e.nombre.includes('Natalio'));

    console.log('Sandra profile:', sandra ? { id: sandra.id, nombre: sandra.nombre, hotel: sandra.hotel } : 'Not found');
    console.log('Natalio profile:', natalio ? { id: natalio.id, nombre: natalio.nombre, hotel: natalio.hotel } : 'Not found');

    // Fetch all events
    const { data: events } = await supabase.from('eventos_cuadrante').select('*');
    console.log(`Loaded ${events.length} events globally.`);

    // Fetch base planning turnos from Excel (since the ExcelLoader is used in admin.js)
    const excelSource = await global.window.ExcelLoader.loadExcelSourceRows();
    const baseRowsFlat = [];

    Object.values(excelSource).flat().forEach(sRow => {
        const rowKeys = [
            global.window.normalizeId(sRow.empleadoId),
            global.window.normalizeId(sRow.displayName),
            global.window.normalizeId(sRow.nombre),
            global.window.normalizeId(sRow.id_interno)
        ].filter(Boolean);
        const fechasSemana = global.window.getFechasSemana ? global.window.getFechasSemana(sRow.weekStart || sRow.week_start) : [];
        (sRow.values || sRow.turnos || []).forEach((turno, idx) => {
            const fecha = fechasSemana[idx];
            if (fecha) {
                baseRowsFlat.push({ empleadoId: sRow.empleadoId || sRow.displayName, fecha, turno: turno || null });
            }
        });
    });

    const baseIndex = global.window.buildIndices(emps, [], baseRowsFlat).baseIndex;

    const testDays = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07'];
    
    console.log('\n--- RESOLVING FOR SANDRA ---');
    for (const day of testDays) {
        const res = global.window.resolveEmployeeDay({
            empleadoId: sandra.id,
            fecha: day,
            eventos: events,
            baseIndex,
            hotel: sandra.hotel || 'Sercotel Guadiana'
        });
        console.log(`Day: ${day}`);
        console.log(`  result.turno: ${res.turno}`);
        console.log(`  result.turnoBase: ${res.turnoBase}`);
        console.log(`  result.incidencia: ${res.incidencia}`);
        console.log(`  result.incidenciaCubierta: ${res.incidenciaCubierta}`);
        console.log(`  result.sustituyeA: ${res.sustituyeA}`);
        console.log(`  result.origen: ${res.origen}`);
        // Let's see active events for this employee on this day
        const activeForDay = events.filter(ev => {
            if (ev.estado === 'anulado') return false;
            if (day < ev.fecha_inicio || day > (ev.fecha_fin || ev.fecha_inicio)) return false;
            return global.window.eventoPerteneceAEmpleado(ev, sandra.id);
        });
        console.log(`  Active events (${activeForDay.length}):`);
        activeForDay.forEach(ev => {
            console.log(`    - ID: ${ev.id}, Tipo: ${ev.tipo}, Origin: ${ev.empleado_id}, Destination: ${ev.empleado_destino_id}, isTitular: ${global.window.isTitularOfAbsence(ev, sandra.id)}`);
        });
    }

    console.log('\n--- RESOLVING FOR NATALIO ---');
    for (const day of testDays) {
        const res = global.window.resolveEmployeeDay({
            empleadoId: natalio.id,
            fecha: day,
            eventos: events,
            baseIndex,
            hotel: natalio.hotel || 'Cumbria Spa&Hotel'
        });
        console.log(`Day: ${day}`);
        console.log(`  result.turno: ${res.turno}`);
        console.log(`  result.turnoBase: ${res.turnoBase}`);
        console.log(`  result.incidencia: ${res.incidencia}`);
        console.log(`  result.incidenciaCubierta: ${res.incidenciaCubierta}`);
        console.log(`  result.sustituyeA: ${res.sustituyeA}`);
        console.log(`  result.origen: ${res.origen}`);
        const activeForDay = events.filter(ev => {
            if (ev.estado === 'anulado') return false;
            if (day < ev.fecha_inicio || day > (ev.fecha_fin || ev.fecha_inicio)) return false;
            return global.window.eventoPerteneceAEmpleado(ev, natalio.id);
        });
        console.log(`  Active events (${activeForDay.length}):`);
        activeForDay.forEach(ev => {
            console.log(`    - ID: ${ev.id}, Tipo: ${ev.tipo}, Origin: ${ev.empleado_id}, Destination: ${ev.empleado_destino_id}, isTitular: ${global.window.isTitularOfAbsence(ev, natalio.id)}`);
        });
    }
}

run().catch(console.error);
