const url = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1/eventos_cuadrante?fecha_inicio=eq.2026-07-16&estado=eq.activo&select=*";
const apikey = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

fetch(url, {
    headers: {
        "apikey": apikey,
        "Authorization": `Bearer ${apikey}`
    }
})
.then(res => res.json())
.then(data => {
    data.forEach(ev => {
        console.log(`ID: ${ev.id}`);
        console.log(`Tipo: ${ev.tipo}`);
        console.log(`Empleado: ${ev.empleado_id}`);
        console.log(`Destino: ${ev.empleado_destino_id}`);
        console.log(`Turno Orig: ${ev.turno_original}`);
        console.log(`Turno Nuevo: ${ev.turno_nuevo}`);
        console.log(`Estado: ${ev.estado}`);
        console.log(`Hotel Origen: ${ev.hotel_origen}`);
        console.log('---');
    });
})
.catch(err => console.error(err));
