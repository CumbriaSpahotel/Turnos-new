const fs = require('fs');
const https = require('https');
const path = require('path');

const API_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const BASE_URL = 'drvmxranbpumianmlzqr.supabase.co';
const BACKUP_DIR = 'C:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\backups';

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

async function fetchTable(tableName) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: `/rest/v1/${tableName}?select=*`,
            headers: { 'apikey': API_KEY }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { 
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function runBackup() {
    console.log('--- STARTING BACKUP (FULL RANGE) ---');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16).replace('T', '_');
    const table = 'turnos';
    
    try {
        console.log(`Backing up ${table}...`);
        const data = await fetchTable(table);
        const fileName = `backup_${timestamp}_turnos_antes_recarga_v9_fullrange.json`;
        const filePath = path.join(BACKUP_DIR, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Successfully backed up ${table}: ${data.length} records.`);
        console.log(`Path: ${filePath}`);
    } catch (e) {
        console.error(`Error backing up ${table}:`, e.message);
        throw e;
    }

    console.log('--- BACKUP COMPLETE ---');
}

runBackup().catch(err => {
    console.error('Backup failed:', err.message);
    process.exit(1);
});
