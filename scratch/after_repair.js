const fs = require('fs');

async function after() {
    const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
    const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

    const fetchSupabase = async (path, method = 'GET') => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const response = await fetch(url.toString(), {
            method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        return await response.json();
    };

    console.log("=== SQL DE DUPLICADOS DESPUÉS ===");
    const allTurnos = await fetchSupabase("/turnos?select=hotel_id,fecha,empleado_id");
    const counts = {};
    allTurnos.forEach(t => {
        if (!t.empleado_id.startsWith('_DUP')) {
            const key = `${t.hotel_id}|${t.fecha}|${t.empleado_id}`;
            counts[key] = (counts[key] || 0) + 1;
        }
    });
    let dups = 0;
    for (const [k, v] of Object.entries(counts)) {
        if (v > 1) {
            console.log(`Duplicado: ${k} (${v} veces)`);
            dups++;
        }
    }
    if (dups === 0) console.log("0 filas duplicadas válidas.");

    console.log("\n=== SQL DE CÓDIGOS DE TURNO DESPUÉS ===");
    const allT = await fetchSupabase("/turnos?select=turno");
    const tCount = {};
    allT.forEach(t => {
        const val = t.turno || 'NULL';
        tCount[val] = (tCount[val] || 0) + 1;
    });
    for (const [k, v] of Object.entries(tCount)) {
        console.log(`Turno: "${k}" -> ${v}`);
    }
}

after();
