const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    // Let's first fetch one employee to see what columns they have
    const { data: existing, error: getErr } = await supabase.from('empleados').select('*').limit(1);
    if (getErr) {
        console.error('Error fetching employee schema/columns:', getErr);
    } else {
        console.log('Existing columns in DB:', Object.keys(existing[0] || {}));
    }

    // Try a simple upsert of a mock payload to see what error it throws
    // We will try to upsert a dummy employee to see if it triggers the 400 error
    const dummyPayload = {
        id: 'TEST_DUMMY_ID',
        nombre: 'TEST_DUMMY_NAME',
        activo: true
    };
    const { error: upsertErr } = await supabase.from('empleados').upsert(dummyPayload);
    if (upsertErr) {
        console.log('Mock upsert error:', {
            code: upsertErr.code,
            message: upsertErr.message,
            details: upsertErr.details,
            hint: upsertErr.hint
        });
    } else {
        console.log('Mock upsert succeeded!');
        // Clean it up
        await supabase.from('empleados').delete().eq('id', 'TEST_DUMMY_ID');
    }
}
run();
