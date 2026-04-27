const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function populateSmart() {
    const fetchS = async (url) => {
        const r = await fetch(SUPABASE_URL + url, { 
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
        });
        return r.json();
    };

    const patchS = async (url, body) => {
        const res = await fetch(SUPABASE_URL + url, {
            method: 'PATCH',
            headers: { 
                'apikey': SUPABASE_ANON_KEY, 
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return res.ok;
    };

    console.log('--- FETCHING EMPLEADOS MAPPING ---');
    const emps = await fetchS('/empleados?select=id,uuid');
    
    const tables = [
        { name: 'turnos', empCol: 'empleado_id', uuidCol: 'empleado_uuid' },
        { name: 'eventos_cuadrante', empCol: 'empleado_id', uuidCol: 'empleado_uuid' },
        { name: 'eventos_cuadrante', empCol: 'empleado_destino_id', uuidCol: 'empleado_destino_uuid' },
        { name: 'peticiones_cambio', empCol: 'solicitante', uuidCol: 'solicitante_uuid' },
        { name: 'peticiones_cambio', empCol: 'companero', uuidCol: 'companero_uuid' }
    ];

    for (const table of tables) {
        console.log(`--- POPULATING ${table.name}.${table.uuidCol} ---`);
        for (const emp of emps) {
            if (!emp.id || !emp.uuid) continue;
            // No encoding names for now, assuming they are clean, but let's be safe
            const encodedId = encodeURIComponent(emp.id);
            const ok = await patchS(`/${table.name}?${table.empCol}=eq.${encodedId}&${table.uuidCol}=is.null`, { [table.uuidCol]: emp.uuid });
            if (ok) {
                // We don't know how many rows were updated without representation, but it's fast
            } else {
                console.error(`Error updating ${table.name} for ${emp.id}`);
            }
        }
    }

    console.log('--- POPULATION COMPLETE ---');
}
populateSmart();
