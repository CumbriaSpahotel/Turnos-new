const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const fs = require('fs');
const path = require('path');

async function backup() {
    try {
        console.log('Fetching turnos...');
        let allData = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(`${SUPABASE_URL}/turnos?select=*&limit=${limit}&offset=${offset}`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
            });
            const data = await response.json();
            if (data.length === 0) {
                hasMore = false;
            } else {
                allData = allData.concat(data);
                offset += limit;
                console.log(`Fetched ${allData.length} records...`);
            }
        }
        
        const fileName = 'backup_20260426_1615_turnos_antes_recarga_v9_corregido.json';
        const backupsDir = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\backups';
        const filePath = path.join(backupsDir, fileName);
        
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
        console.log(`\nSUCCESS: Backup created at ${filePath}`);
        console.log(`Total records exported: ${allData.length}`);
    } catch (err) {
        console.error('ERROR: Backup failed:', err.message);
        process.exit(1);
    }
}
backup();
