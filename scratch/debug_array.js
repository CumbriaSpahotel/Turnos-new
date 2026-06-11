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
        hoteles_asignados: ['Cumbria Spa&Hotel', 'Sercotel Guadiana']
    };

    const { error } = await supabase.from('empleados').upsert(dummyPayload);
    if (error) {
        console.log('Error details:');
        console.log('Code:', error.code);
        console.log('Message:', error.message);
        console.log('Details:', error.details);
        console.log('Hint:', error.hint);
    } else {
        console.log('Upsert succeeded.');
        await supabase.from('empleados').delete().eq('id', 'TEST_DUMMY_ID');
    }
}
run();
