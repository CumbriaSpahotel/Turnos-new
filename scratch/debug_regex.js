const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const dummyPayload = {
        id: 'TEST_DUMMY_ID',
        nombre: 'TEST_DUMMY_NAME',
        activo: true,
        vacaciones_anuales: 30, // Column not present in DB
        rol: 'titular', // Column not present in DB
        rol_operativo: 'titular' // Column not present in DB
    };

    const { error } = await supabase.from('empleados').upsert(dummyPayload);
    if (error) {
        console.log('Error details:');
        console.log('Code:', error.code);
        console.log('Message:', error.message);
        console.log('Details:', error.details);
        console.log('Hint:', error.hint);
        
        const errorStr = String(error?.details || error?.message || error?.hint || '');
        const missingColumn = errorStr.match(/column ["']([^"']+)["']/i)?.[1] || 
                             errorStr.match(/Could not find column ["']([^"']+)["']/i)?.[1] ||
                             errorStr.match(/'([^']+)' column/i)?.[1];
        
        console.log('Regex matched missingColumn:', missingColumn);
    } else {
        console.log('Upsert succeeded unexpectedly.');
    }
}
run();
