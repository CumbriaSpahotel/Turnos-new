const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

async function validateDB() {
    const res = await fetch(`${SUPABASE_URL}/turnos?hotel_id=eq.Cumbria%20Spa%26Hotel&fecha=gte.2026-04-20&fecha=lte.2026-04-26&select=fecha,empleado_id,turno`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    const data = await res.json();
    const emps = ['Cristina', 'Esther', 'Sergio', 'Valentín', 'Isabel Hidalgo'];
    console.log("Empleado".padEnd(15) + " | 20 21 22 23 24 25 26 (Abril 2026)");
    console.log("-".repeat(50));
    emps.forEach(emp => {
        const empTurnos = data.filter(d => d.empleado_id === emp);
        const row = [];
        for (let d = 20; d <= 26; d++) {
            const date = `2026-04-${d}`;
            const t = empTurnos.find(x => x.fecha === date);
            row.push(t ? t.turno : '-');
        }
        console.log(emp.padEnd(15) + " | " + row.join(' '));
    });
}
validateDB();
