const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function check() {
    try {
        const r = await fetch(`${SUPABASE_URL}/turnos?empleado_id=ilike.Valent*&fecha=eq.2026-04-06`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
        });
        const data = await r.json();
        console.log('Valentín records in DB:', data.length);
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(err);
    }
}
check();
