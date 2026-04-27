const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function fixEventos() {
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    };

    console.log('--- FETCHING EMPLEADOS ---');
    const emps = await fetchS('/empleados?select=id,uuid,nombre');
    const map = new Map();
    emps.forEach(e => {
        const key = e.id.trim().toLowerCase();
        map.set(key, e.uuid);
        if (e.nombre) map.set(e.nombre.trim().toLowerCase(), e.uuid);
    });

    console.log('--- FIXING EVENTOS ---');
    const eventos = await fetchS('/eventos_cuadrante?select=id,empleado_id,empleado_destino_id&or=(empleado_uuid.is.null,empleado_destino_uuid.is.null)');
    console.log(`Found ${eventos.length} potential events to fix.`);

    let fixedCount = 0;
    for (const ev of eventos) {
        const update = {};
        if (ev.empleado_id) {
            const uuid = map.get(ev.empleado_id.trim().toLowerCase());
            if (uuid) update.empleado_uuid = uuid;
        }
        if (ev.empleado_destino_id) {
            const uuid = map.get(ev.empleado_destino_id.trim().toLowerCase());
            if (uuid) update.empleado_destino_uuid = uuid;
        }

        if (Object.keys(update).length > 0) {
            const res = await patchS(`/eventos_cuadrante?id=eq.${ev.id}`, update);
            if (res.ok) fixedCount++;
        }
    }
    console.log(`Fixed ${fixedCount} events.`);
}
fixEventos();
