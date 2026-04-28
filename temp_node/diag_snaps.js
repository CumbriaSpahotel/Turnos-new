const https = require('https');

const url = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1/publicaciones_cuadrante?semana_inicio=eq.2026-05-04&hotel=eq.Cumbria%20Spa%26Hotel&order=version.desc";
const options = {
  headers: {
    'apikey': 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ',
    'Authorization': 'Bearer sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
        const snaps = JSON.parse(data);
        const s = snaps[0];
        console.log(`Version: ${s.version}`);
        const rows = s.data.rows || [];
        rows.sort((a,b) => (a.puestoOrden || 999) - (b.puestoOrden || 999)).forEach(r => {
            console.log(`  [${r.puestoOrden}] ${r.nombre} (ID: ${r.empleado_id}) | Type: ${r.rowType}`);
        });
    } catch(e) { console.log(data); }
  });
}).on('error', console.error);
