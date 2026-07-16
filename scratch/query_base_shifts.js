const url = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1/turnos?fecha=eq.2026-07-16&select=*";
const apikey = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

fetch(url, {
    headers: {
        "apikey": apikey,
        "Authorization": `Bearer ${apikey}`
    }
})
.then(res => res.json())
.then(data => {
    data.forEach(t => {
        console.log(`Empleado: ${t.empleado_id}`);
        console.log(`Fecha: ${t.fecha}`);
        console.log(`Turno Base: ${t.turno}`);
        console.log(`Tipo: ${t.tipo}`);
        console.log(`Hotel: ${t.hotel_id}`);
        console.log('---');
    });
})
.catch(err => console.error(err));
