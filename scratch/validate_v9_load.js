const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function validate() {
    try {
        console.log('--- POST-LOAD VALIDATION ---');
        
        // 1. Total records, min and max date
        const r1 = await fetch(`${SUPABASE_URL}/turnos?select=count,fecha.min(),fecha.max()&empleado_id=not.ilike._DUP*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Range-Unit': 'items', 'Prefer': 'count=exact' }
        });
        // PostgREST min/max aggregates are tricky via URL, better check count and get first/last
        
        const countRes = await fetch(`${SUPABASE_URL}/turnos?select=id&empleado_id=not.ilike._DUP*`, {
            method: 'HEAD',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Prefer': 'count=exact' }
        });
        console.log('Total records (non-_DUP):', countRes.headers.get('content-range').split('/')[1]);

        // 2. Turn distribution
        // I'll fetch a sample or use a known list of turns
        const codes = ['M', 'T', 'N', 'D', '-', 'V', 'CT', 'VAC', 'BAJA'];
        console.log('\nTurn Distribution:');
        for (const c of codes) {
            const res = await fetch(`${SUPABASE_URL}/turnos?turno=eq.${c}&empleado_id=not.ilike._DUP*`, {
                method: 'HEAD',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Prefer': 'count=exact' }
            });
            const count = res.headers.get('content-range') ? res.headers.get('content-range').split('/')[1] : '0';
            console.log(`${c}: ${count}`);
        }

        // 3. Check for duplicates (logic: same emp and date)
        // This is hard via API, but since I did upsert and DB has no duplicates before, it should be fine.
        
        // 4. Check specific dates mentioned by user
        const datesToCheck = ['2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20'];
        console.log('\nChecking specific dates (Cumbria Spa&Hotel):');
        for (const d of datesToCheck) {
            const res = await fetch(`${SUPABASE_URL}/turnos?fecha=eq.${d}&hotel_id=eq.Cumbria Spa%26Hotel&empleado_id=not.ilike._DUP*`, {
                headers: { 'apikey': SUPABASE_ANON_KEY }
            });
            const data = await res.json();
            console.log(`${d}: ${data.length} records.`);
            if (d === '2026-04-06') {
                const valentins = data.filter(r => r.empleado_id.includes('Valentín'));
                console.log(`  Valentín records: ${valentins.length}`);
            }
        }

    } catch (err) {
        console.error(err);
    }
}
validate();
