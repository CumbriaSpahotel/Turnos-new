const fs = require('fs');
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

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
global.window.supabase = supabase;
global.window.TurnosDB = { client: supabase };

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

require('c:/Users/comun/Documents/GitHub/Turnos-new/excel-loader.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/shift-resolver.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/turnos-engine.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-dao.js');
require('c:/Users/comun/Documents/GitHub/Turnos-new/admin.js');

async function run() {
    // Populate globals
    const emps = await global.window.TurnosDB.getEmpleados();
    global.window.empleadosGlobales = emps;
    
    const { data: events } = await supabase.from('eventos_cuadrante').select('*');
    global.window.eventosActivos = events;
    global.window.eventosGlobales = events;
    
    console.log('Running buildEmployeeProfileModel for Diana...');
    const model = global.window.buildEmployeeProfileModel('EMP-0009', '2026-06-11');
    
    console.log('\n--- vacs in model.yearGroupedVacs ---');
    model.yearGroupedVacs.forEach(ev => {
        console.log(`- ID: ${ev.id}, Tipo: ${ev.tipo}, Start: ${ev.fecha_inicio}, End: ${ev.fecha_fin}, isGroup: ${ev.isGroup}`);
    });
}

run().catch(console.error);
