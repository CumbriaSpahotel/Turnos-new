const fs = require('fs');

async function backup() {
    const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
    const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

    const tables = ['empleados', 'turnos', 'eventos_cuadrante', 'peticiones_cambio'];
    const date = new Date();
    const ts = date.toISOString().replace(/[:.]/g, '-');
    const yyyymmdd = ts.slice(0, 10).replace(/-/g, '');
    const hhmm = ts.slice(11, 16).replace(/-/g, '');
    
    const prefix = `backup_${yyyymmdd}_${hhmm}`;

    for (const t of tables) {
        console.log(`Backing up ${t}...`);
        const r = await fetch(`${SUPABASE_URL}/${t}?select=*`, { 
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
        });
        const data = await r.json();
        const fileName = `c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\backups\\${prefix}_${t}_antes_uuid_fase1.json`;
        fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
        console.log(`Saved to ${fileName}`);
    }
}
backup();
