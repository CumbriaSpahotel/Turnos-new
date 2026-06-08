const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
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
const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
global.window.supabase = supabase;
global.window.TurnosDB = { client: supabase };

const adminPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
const adminContent = fs.readFileSync(adminPath, 'utf8');

global.$ = () => ({ innerHTML: '', classList: { remove:()=>{} }, addEventListener: ()=>{} });

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
global.window.getFechasSemana = (lunesIso) => {
    const d = new Date(lunesIso+'T12:00:00');
    return Array.from({length:7}, (_, i) => {
        const nd = new Date(d);
        nd.setDate(nd.getDate() + i);
        return global.window.isoDate(nd);
    });
};

global.fetch = async (url) => {
    if (typeof url==='string' && url.includes('V.9-Turnos.xlsx')) {
        const buffer = fs.readFileSync(path.resolve('c:/Users/comun/Documents/GitHub/Turnos-new', url));
        return { ok: true, arrayBuffer: async () => buffer };
    }
    return null;
};
global.XLSX = require('xlsx');

require('c:/Users/comun/Documents/GitHub/Turnos-new/excel-loader.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/shift-resolver.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/turnos-engine.js');

async function run() {
    const start = new Date(); start.setDate(start.getDate() - 7);
    const end = new Date(); end.setDate(end.getDate() + 7);
    const excelSource = await global.window.ExcelLoader.loadExcelSourceRows();
    const hotelExcelRows = excelSource['Cumbria Spa&Hotel'] || [];
    const ambosExcelRows = excelSource['Ambos hoteles'] || [];
    const combinedExcelRows = [...hotelExcelRows, ...ambosExcelRows];
    
    const today = new Date();
    const todayISO = global.window.isoDate(today);
    
    const weekSeed = combinedExcelRows.find(r => global.window.getFechasSemana(r?.weekStart).includes(todayISO));
    if (!weekSeed) { console.log('No weekSeed found for', todayISO); return; }
    
    const weekStartIso = weekSeed.weekStart;
    const fechasSemana = global.window.getFechasSemana(weekStartIso);
    const sourceIndex = Math.max(0, fechasSemana.indexOf(todayISO));
    const weekExcelRows = combinedExcelRows.filter(r => r.weekStart === weekStartIso);
    
    // Mock data for DB
    const rows = [];
    const events = [];
    const employees = [ { id: 'Isabel Hidalgo', nombre: 'Isabel Hidalgo', hotel_id: 'Cumbria Spa&Hotel' } ];
    
    const dayRoster = global.window.TurnosEngine.buildDayRoster({ 
        rows, events, employees, date: todayISO, hotel: 'Cumbria Spa&Hotel', 
        sourceRows: weekExcelRows, sourceIndex 
    });
    
    console.log('DayRoster entries for', todayISO, ':', dayRoster.length);
    const entry = dayRoster.find(e => (e.id || e.displayAs || e.norm || '').includes('isabel'));
    if (entry) {
        console.log('Isabel cell:', entry.cell);
    } else {
        console.log('Isabel not found in dayRoster');
        if (dayRoster.length > 0) console.log('First entry:', dayRoster[0].cell);
    }
}
run().catch(console.error);
