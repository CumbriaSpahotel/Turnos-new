const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function check() {
    try {
        const r = await fetch(`${SUPABASE_URL}/turnos?empleado_id=ilike.Esther*&fecha=eq.2030-01-03`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
        });
        const data = await r.json();
        console.log('Records for Esther 2030-01-03:', data.length);
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(err);
    }
}
check();
