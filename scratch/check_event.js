
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkEvent() {
    try {
        // Read config from supabase-config.js (it's a window export usually, let's parse it)
        const configText = fs.readFileSync('supabase-config.js', 'utf8');
        const urlMatch = configText.match(/SUPABASE_URL:\s*['"](.+?)['"]/);
        const keyMatch = configText.match(/SUPABASE_KEY:\s*['"](.+?)['"]/);
        
        if (!urlMatch || !keyMatch) throw new Error("Config not found");
        
        const supabase = createClient(urlMatch[1], keyMatch[1]);
        
        console.log("Checking events for EMP-0004 or Sergio around 2026-04-28...");
        
        const { data, error } = await supabase
            .from('eventos_cuadrante')
            .select('*')
            .or('empleado_id.eq.EMP-0004,empleado_id.ilike.%Sergio%')
            .gte('fecha_inicio', '2026-04-20')
            .lte('fecha_inicio', '2026-05-10');
            
        if (error) throw error;
        
        console.log("RESULTS:");
        console.log(JSON.stringify(data, null, 2));
        
        // Also check if EMP-0004 exists and to which hotel it belongs
        const { data: emp, error: err2 } = await supabase
            .from('empleados')
            .select('*')
            .or('id.eq.EMP-0004,nombre.ilike.%Sergio%');
            
        console.log("\nEMPLOYEE INFO:");
        console.log(JSON.stringify(emp, null, 2));

    } catch (e) {
        console.error(e);
    }
}

checkEvent();
