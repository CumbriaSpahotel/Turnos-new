const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function query() {
    try {
        const r = await fetch(`${SUPABASE_URL}/rpc/exec_sql`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sql: "SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'public.turnos'::regclass AND i.indisprimary;" 
            })
        });
        const data = await r.json();
        console.log('Primary Key Columns:', JSON.stringify(data));
    } catch (err) {
        console.error(err);
    }
}
query();
