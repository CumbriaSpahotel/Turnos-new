const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function populateFast() {
    const fetchS = async (url) => {
        const r = await fetch(SUPABASE_URL + url, { 
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
        });
        return r.json();
    };

    const upsertS = async (url, data) => {
        const res = await fetch(SUPABASE_URL + url, {
            method: 'POST',
            headers: { 
                'apikey': SUPABASE_ANON_KEY, 
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.text();
            console.error(`Error in ${url}: ${res.status} - ${err}`);
            return false;
        }
        return true;
    };

    console.log('--- FETCHING EMPLEADOS MAPPING ---');
    const emps = await fetchS('/empleados?select=id,uuid');
    const map = new Map();
    emps.forEach(e => map.set(e.id, e.uuid));

    const processTable = async (tableName, idField, empField, uuidField) => {
        console.log(`--- PROCESSING ${tableName} ---`);
        let offset = 0;
        const limit = 500; // Smaller chunks to avoid 413
        while (true) {
            const data = await fetchS(`/${tableName}?select=${idField},${empField}&${uuidField}=is.null&limit=${limit}`);
            if (data.length === 0) break;
            
            const batch = data.map(item => {
                const uuid = map.get(item[empField]);
                if (uuid) return { [idField]: item[idField], [uuidField]: uuid };
                return null;
            }).filter(x => x);

            if (batch.length > 0) {
                const ok = await upsertS(`/${tableName}`, batch);
                if (ok) {
                    console.log(`Updated ${batch.length} rows in ${tableName}`);
                } else {
                    console.log(`Skipping batch in ${tableName} due to error`);
                    // If we can't update, we might need an offset or we'll loop
                    // But for now let's just break to see the error
                    break;
                }
            } else {
                console.log(`No mappable rows in this batch of ${tableName}`);
                break;
            }
        }
    };

    await processTable('turnos', 'id', 'empleado_id', 'empleado_uuid');
    await processTable('eventos_cuadrante', 'id', 'empleado_id', 'empleado_uuid');
    await processTable('peticiones_cambio', 'id', 'solicitante', 'solicitante_uuid');

    console.log('--- POPULATION COMPLETE ---');
}
populateFast();
