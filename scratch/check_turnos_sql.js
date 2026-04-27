const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function query() {
    try {
        const r = await fetch(`${SUPABASE_URL}/rpc/exec_sql`, {
            method: 'POST',
            headers: { 
                'apikey': SUPABASE_ANON_KEY, 
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                sql: "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.turnos'::regclass;" 
            })
        });
        const data = await r.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(err);
    }
}
query();
