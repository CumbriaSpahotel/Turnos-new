
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixNatalia() {
    console.log("Iniciando corrección de Natalia -> Natalio...");

    // 1. Empleados
    const { data: emps, error: errEmp } = await supabase
        .from('empleados')
        .select('*')
        .or('id.eq.Natalia,nombre.ilike.%Natalia%');
    
    if (errEmp) console.error("Error buscando empleados:", errEmp);
    else console.log("Empleados encontrados:", emps);

    // Si existe Natalia como ID, hay que tener cuidado porque es la PK.
    // Lo más seguro es crear Natalio y luego migrar todo, o si Natalia no tiene ID Natalia pero sí nombre...
    
    // 2. Turnos
    const { count: turnosCount, error: errTurnos } = await supabase
        .from('turnos')
        .update({ empleado_id: 'Natalio' })
        .eq('empleado_id', 'Natalia');
    
    if (errTurnos) console.warn("Error migrando turnos (empleado_id):", errTurnos);
    else console.log("Turnos migrados (empleado_id):", turnosCount);

    const { count: turnosSubCount, error: errTurnosSub } = await supabase
        .from('turnos')
        .update({ sustituto: 'Natalio' })
        .eq('sustituto', 'Natalia');
    
    if (errTurnosSub) console.warn("Error migrando turnos (sustituto):", errTurnosSub);
    else console.log("Turnos migrados (sustituto):", turnosSubCount);

    // 3. Eventos
    const { count: evCount, error: errEv } = await supabase
        .from('eventos_cuadrante')
        .update({ empleado_id: 'Natalio' })
        .eq('empleado_id', 'Natalia');
    
    if (errEv) console.warn("Error migrando eventos (empleado_id):", errEv);
    
    const { count: evDestCount, error: errEvDest } = await supabase
        .from('eventos_cuadrante')
        .update({ empleado_destino_id: 'Natalio' })
        .eq('empleado_destino_id', 'Natalia');

    if (errEvDest) console.warn("Error migrando eventos (empleado_destino_id):", errEvDest);

    console.log("Proceso finalizado.");
}

fixNatalia();
