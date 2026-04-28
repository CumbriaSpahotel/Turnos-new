const fs = require('fs');
const path = require('path');

global.window = {};
const daoCode = fs.readFileSync(path.join(__dirname, '../supabase-dao.js'), 'utf8');
eval(daoCode);

async function check() {
    try {
        const snaps = await global.window.TurnosDB.loadPublishedSchedule('2026-05-04', '2026-05-04', 'Cumbria Spa&Hotel');
        if (!snaps || snaps.length === 0) {
            console.log('No snapshots found');
            return;
        }
        const latest = snaps[0]; // loadPublishedSchedule returns the best valid version
        console.log('--- SNAPSHOT V' + latest.version + ' ---');
        latest.rows.forEach(r => {
            console.log(`Emp: ${r.nombre} | Type: ${r.rowType} | Order: ${r.puestoOrden} | ID: ${r.empleado_id}`);
        });
    } catch (e) {
        console.error(e);
    }
}

check();
