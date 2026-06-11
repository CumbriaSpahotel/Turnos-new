const fs = require('fs');
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
global.$ = () => ({ innerHTML: '', classList: { remove:()=>{} }, addEventListener: ()=>{} });

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
global.window.supabase = supabase;
global.window.TurnosDB = { client: supabase };

// Load the updated supabase-dao.js
require('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-dao.js');

async function run() {
    // Intercept console.error and console.warn to count errors
    let errorCount = 0;
    let warnCount = 0;
    const origError = console.error;
    const origWarn = console.warn;
    console.error = (...args) => {
        errorCount++;
        origError(...args);
    };
    console.warn = (...args) => {
        warnCount++;
        origWarn(...args);
    };

    // Mock employee edit form payload
    const payload = {
        id: 'TEST_DUMMY_ID',
        nombre: 'TEST_DUMMY_NAME',
        email: 'test@example.com',
        telefono: '123456789',
        hotel: 'Cumbria Spa&Hotel',
        hotel_id: 'Cumbria Spa&Hotel',
        hoteles_asignados: ['Cumbria Spa&Hotel'],
        puesto: 'Personal',
        categoria: 'Personal',
        tipo: 'fijo',
        tipo_personal: 'fijo',
        contrato: 'fijo',
        rol: 'titular', // Not in DB, but in form payload. It should be filtered out by EMPLEADO_COLUMNS.
        rol_operativo: 'titular', // Not in DB, but in form payload. It should be filtered out by EMPLEADO_COLUMNS.
        estado: 'Activo',
        estado_empresa: 'Activo',
        activo: true,
        vacaciones_anuales: 44, // Not in DB, but in form. It should be filtered out by EMPLEADO_COLUMNS.
        ajuste_vacaciones_dias: 0,
        observaciones: 'Test'
    };

    console.log('Running upsertEmpleado...');
    try {
        await global.window.TurnosDB.upsertEmpleado(payload);
        console.log('Upsert completed.');
        console.log('Total console.error logged:', errorCount);
        console.log('Total console.warn logged:', warnCount);
        
        if (errorCount === 0 && warnCount === 0) {
            console.log('VERIFICATION PASSED: Succeeded on the first try with 0 errors/warnings.');
        } else {
            console.log('VERIFICATION FAILED: Had errors/warnings.');
        }
    } catch (e) {
        console.error('Upsert failed with exception:', e);
    } finally {
        // Clean up dummy employee
        await supabase.from('empleados').delete().eq('id', 'TEST_DUMMY_ID');
    }
}
run();
