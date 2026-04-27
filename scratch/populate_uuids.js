const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function populate() {
    const fetchS = async (url) => {
        const r = await fetch(SUPABASE_URL + url, { 
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
        });
        return r.json();
    };

    const patchS = async (url, body) => {
        return fetch(SUPABASE_URL + url, {
            method: 'PATCH',
            headers: { 
                'apikey': SUPABASE_ANON_KEY, 
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(body)
        });
    };

    console.log('--- FETCHING EMPLEADOS MAPPING ---');
    const emps = await fetchS('/empleados?select=id,uuid');
    const map = new Map();
    emps.forEach(e => map.set(e.id, e.uuid));

    // 1. Turnos
    console.log('--- POPULATING TURNOS ---');
    const turnos = await fetchS('/turnos?select=id,empleado_id&empleado_uuid=is.null');
    console.log(`Found ${turnos.length} turnos to populate.`);
    for (const t of turnos) {
        const uuid = map.get(t.empleado_id);
        if (uuid) {
            await patchS(`/turnos?id=eq.${t.id}`, { empleado_uuid: uuid });
        }
    }

    // 2. Eventos
    console.log('--- POPULATING EVENTOS ---');
    const eventos = await fetchS('/eventos_cuadrante?select=id,empleado_id,empleado_destino_id&or=(empleado_uuid.is.null,empleado_destino_uuid.is.null)');
    console.log(`Found ${eventos.length} eventos to populate.`);
    for (const ev of eventos) {
        const update = {};
        const uuid1 = map.get(ev.empleado_id);
        const uuid2 = map.get(ev.empleado_destino_id);
        if (uuid1) update.empleado_uuid = uuid1;
        if (uuid2) update.empleado_destino_uuid = uuid2;
        if (Object.keys(update).length > 0) {
            await patchS(`/eventos_cuadrante?id=eq.${ev.id}`, update);
        }
    }

    // 3. Peticiones
    console.log('--- POPULATING PETICIONES ---');
    const pets = await fetchS('/peticiones_cambio?select=id,solicitante,companero&or=(solicitante_uuid.is.null,companero_uuid.is.null)');
    console.log(`Found ${pets.length} peticiones to populate.`);
    for (const p of pets) {
        const update = {};
        const uuid1 = map.get(p.solicitante);
        const uuid2 = map.get(p.companero);
        if (uuid1) update.solicitante_uuid = uuid1;
        if (uuid2) update.companero_uuid = uuid2;
        if (Object.keys(update).length > 0) {
            await patchS(`/peticiones_cambio?id=eq.${p.id}`, update);
        }
    }

    console.log('--- POPULATION COMPLETE ---');
}
populate();
