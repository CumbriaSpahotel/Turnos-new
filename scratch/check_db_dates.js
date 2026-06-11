const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const configContent = fs.readFileSync('c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js', 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: turnos, error } = await supabase.from('turnos').select('fecha').order('fecha', { ascending: true });
    if (error) {
        console.error('Error fetching turnos:', error);
        return;
    }
    console.log('Total turnos in DB:', turnos.length);
    if (turnos.length > 0) {
        console.log('First turno date:', turnos[0].fecha);
        console.log('Last turno date:', turnos[turnos.length - 1].fecha);
        
        // Count turnos around June 2026
        const june26 = turnos.filter(t => t.fecha.startsWith('2026-06'));
        console.log('Total turnos in June 2026:', june26.length);
    }
}
run();
