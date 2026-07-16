const url = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1/eventos_cuadrante?fecha_inicio=eq.2026-07-16&select=*";
const apikey = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

fetch(url, {
    headers: {
        "apikey": apikey,
        "Authorization": `Bearer ${apikey}`
    }
})
.then(res => res.json())
.then(data => {
    console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
