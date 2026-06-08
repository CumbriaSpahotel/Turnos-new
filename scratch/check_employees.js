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
require('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-dao.js');
require(adminPath);

async function run() {
    await global.window.populateEmployees();
    const models = global.window._employeeLineModels;
    if (!models) {
        console.log('No models generated.');
        return;
    }
    console.log('Total models:', models.length);
    const blanks = models.filter(m => !m.id || !m.nombre || m.nombre === 'Empleado' || m.nombre.trim() === '');
    console.log('Blank models:', blanks.length, blanks.map(b => b.id || 'N/A'));
    
    // Pick an employee
    const emp = models.find(m => m.nombre && (m.nombre.includes('Isabel Hidalgo') || m.nombre.includes('Federico')));
    if (emp) {
        console.log('Found:', emp.nombre);
        console.log('History length:', emp.history.length);
        console.log('Today shift:', emp.turnoHoy);
        console.log('Next shift:', emp.proximoTurno);
        if (emp.history.length > 0) {
            console.log('Sample history:', emp.history.slice(0, 3));
        }
    }
}
run().catch(console.error);
