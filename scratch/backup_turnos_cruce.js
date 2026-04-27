const fs = require('fs');

async function backupTurnos() {
    const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
    const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

    const response = await fetch(`${SUPABASE_URL}/turnos?select=*`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    
    if (!response.ok) {
        throw new Error("Failed to fetch turnos");
    }
    const data = await response.json();
    
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    
    const fileName = `c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\backups\\backup_${yyyy}${mm}${dd}_${hh}${min}_turnos_antes_fix_cruce_mes.json`;
    
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
    console.log(`Backup creado en: ${fileName}`);
    console.log(`Total registros: ${data.length}`);
}

backupTurnos();
