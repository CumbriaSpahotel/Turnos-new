
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract keys from supabase-dao.js or similar
const daoContent = fs.readFileSync('supabase-dao.js', 'utf8');
const urlMatch = daoContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = daoContent.match(/const SUPABASE_KEY = ["'](.+?)["']/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find Supabase credentials");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkEvents() {
    const { data, error } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .or('empleado_id.ilike.%Dani%,empleado_destino_id.ilike.%Dani%')
        .order('fecha_inicio', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    console.log("Events found for Dani:");
    data.forEach(ev => {
        console.log(`${ev.fecha_inicio} | ${ev.tipo} | ${ev.empleado_id} ↔ ${ev.empleado_destino_id} | ${ev.estado}`);
    });
}

checkEvents();
