const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

global.window = {
    supabase: null,
    localforage: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
        clear: async () => {}
    },
    addEventListener: () => {}
};

global.document = {
    getElementById: () => ({ textContent: '', style: {}, innerHTML: '', value: '' }),
    querySelector: () => ({ textContent: '', style: {}, innerHTML: '', value: '' }),
    querySelectorAll: () => [],
    addEventListener: () => {}
};

const configPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js';
const configContent = fs.readFileSync(configPath, 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find Supabase config");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);
global.window.supabase = supabase;

// Mock fetch for V.9-Turnos.xlsx
const originalFetch = global.fetch;
const path = require('path');
global.fetch = async (url, options) => {
    if (typeof url === 'string' && url.includes('V.9-Turnos.xlsx')) {
        const filePath = path.resolve('c:/Users/comun/Documents/GitHub/Turnos-new', url);
        const buffer = fs.readFileSync(filePath);
        return {
            ok: true,
            arrayBuffer: async () => buffer
        };
    }
    return originalFetch ? originalFetch(url, options) : null;
};

// Load XLSX library
global.XLSX = require('xlsx');

// Mock admin environment variables/functions
global.window.normalizeId = (val) => String(val || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
global.window.normalizeTipo = (tipo) => String(tipo || '').trim().toUpperCase();
global.window.normalizeEstado = (est) => String(est || '').trim().toLowerCase();
global.window.normalizeDate = (d) => String(d || '').trim().slice(0, 10);
global.window.addIsoDays = (iso, n) => {
    if (!iso) return null;
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
global.window.getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};
global.window.isoDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(value).slice(0, 10);
};
global.window.getFechasSemana = (lunesIso) => {
    return Array.from({ length: 7 }, (_, i) => global.window.addIsoDays(lunesIso, i));
};
global.window.formatDisplayName = (name) => {
    if (!name) return '';
    return name.replace(/_DUP_.*$/, '').replace(/_CT$/, '').replace(/_/g, ' ').trim();
};
global.window.buildPuestoId = (hotel, idx) => `${hotel}_Puesto_${idx}`;

const excelLoaderPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/excel-loader.js';
require(excelLoaderPath);

const resolverPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/shift-resolver.js';
require(resolverPath);

const enginePath = 'c:/Users/comun/Documents/GitHub/Turnos-new/turnos-engine.js';
require(enginePath);

const daoPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/supabase-dao.js';
require(daoPath);

const adminPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
const adminContent = fs.readFileSync(adminPath, 'utf8');

// We need to run createPuestosPreviewModel from admin.js
global.window.TurnosDB = global.window.TurnosDB || {};
global.window.TurnosDB.client = supabase;

require(adminPath);

async function run() {
    console.log("=== RUNNING MONTHLY PREVIEW ROW GENERATION ===");
    const hName = 'Cumbria Spa&Hotel';
    const weekStart = '2026-06-01';
    const weekEnd = '2026-06-30';
    
    // Generate dates for the whole month of June 2026
    const dates = [];
    let curr = new Date(weekStart + 'T12:00:00');
    const end = new Date(weekEnd + 'T12:00:00');
    while (curr <= end) {
        dates.push(global.window.isoDate(curr));
        curr.setDate(curr.getDate() + 1);
    }
    
    const columns = dates.map(d => ({
        date: d,
        dayName: ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'][new Date(d + 'T12:00:00').getDay()]
    }));
    
    const profiles = await global.window.TurnosDB.getEmpleados();
    const excelSource = await global.window.ExcelLoader.loadExcelSourceRows();
    const hotelExcelRows = excelSource[hName] || [];
    
    // In monthly view, renderPreview loads all Excel rows in the range
    const hotelSourceRows = hotelExcelRows.filter(row => {
        if (!row?.weekStart) return false;
        const rowEnd = global.window.addIsoDays(row.weekStart, 6);
        return row.weekStart <= weekEnd && rowEnd >= weekStart;
    });
    
    const { rows: data } = await global.window.TurnosDB.fetchRangoCalculado(weekStart, weekEnd);
    const eventos = await global.window.TurnosDB.fetchEventos(weekStart, weekEnd);
    
    const previewModel = global.window.createPuestosPreviewModel({
        hotel: hName,
        dates: dates,
        sourceRows: hotelSourceRows,
        rows: data.filter(r => r.hotel_id === hName),
        eventos,
        employees: profiles
    });
    
    const employeesToRender = previewModel.getEmployees('monthly');
    const seenEmps = new Set();
    const deduplicatedList = [];
    employeesToRender.forEach(emp => {
        const key = emp.employee_id;
        const rawName = String(emp.nombre || emp.displayName || emp.employee_id || '').trim();
        if (rawName.includes('---') || rawName.includes('___') || rawName === '' || rawName.toLowerCase() === 'vacante') {
            return;
        }
        if (!seenEmps.has(key)) {
            seenEmps.add(key);
            deduplicatedList.push(emp);
        }
    });
    
    console.log(`\nGenerated rows count: ${deduplicatedList.length}`);
    deduplicatedList.forEach(employee => {
        const headerHtml = global.window.renderEmpleadoRowHeader(employee, { showVacationIcon: true, isCompact: true });
        const cellValues = columns.slice(0, 6).map(c => {
            const resolved = previewModel.getTurnoEmpleado(employee.employee_id, c.date);
            return resolved.turno || resolved.incidencia || resolved.turnoBase || '—';
        });
        
        console.log(`\nRow for Employee ID: "${employee.employee_id}"`);
        console.log(`- Header HTML: ${JSON.stringify(headerHtml.trim())}`);
        console.log(`- First 6 Cell values: ${JSON.stringify(cellValues)}`);
    });
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
