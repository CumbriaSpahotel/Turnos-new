const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: emps, error } = await supabase.from('empleados').select('*');
    if (error) {
        console.error('Error fetching employees:', error);
        return;
    }
    const targets = emps.filter(e => e.nombre.includes('Antonio') || e.nombre.includes('Gustavo'));
    console.log('--- TARGET PROFILES ---');
    targets.forEach(t => {
        console.log({
            id: t.id,
            nombre: t.nombre,
            activo: t.activo,
            estado: t.estado,
            estado_empresa: t.estado_empresa,
            tipo_personal: t.tipo_personal,
            contrato: t.contrato
        });
    });
}
run();
