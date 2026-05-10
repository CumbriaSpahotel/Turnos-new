/**
 * Query eventos_cuadrante for October 2026 active events.
 */
const fs = require('fs');
const path = require('path');

const configRaw = fs.readFileSync(path.join(__dirname, '..', 'supabase-config.js'), 'utf8');
const urlMatch = configRaw.match(/SUPABASE_URL\s*[=:]\s*['"`]([^'"`]+)/);
const keyMatch = configRaw.match(/SUPABASE_ANON_KEY\s*[=:]\s*['"`]([^'"`]+)/);
const SUPABASE_URL = urlMatch[1];
const SUPABASE_KEY = keyMatch[1];
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

async function query(table, qs) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
}

async function main() {
    const OCT_START = '2026-10-19';
    const OCT_END   = '2026-10-25';

    console.log('\n===== OCTOBER EVENTS + SNAPSHOT DETAIL =====\n');

    // 1. Query eventos_cuadrante for Oct range
    console.log('[OCT_PENDING_PUBLICATION_CHECK]');
    try {
        const evts = await query('eventos_cuadrante',
            `select=*&fecha=gte.${OCT_START}&fecha=lte.${OCT_END}&order=created_at.desc`);
        const ACTIVE = ['activo','activa','aprobado','aprobada','pendiente'];
        const active = evts.filter(e => ACTIVE.includes((e.estado||'').toLowerCase()));
        console.log('  eventosOctubre=' + evts.length);
        console.log('  eventosActivos=' + active.length);
        console.log('  hasChanges=' + (active.length > 0));
        active.forEach((e, i) => {
            console.log(`  [${i+1}] id=${e.id} tipo=${e.tipo} estado=${e.estado} fecha=${e.fecha}`);
            console.log(`       origen=${e.empleado_id||e.origen} destino=${e.empleado_destino||e.destino||'n/a'}`);
            console.log(`       hotel=${e.hotel_id||e.hotel_origen||'n/a'} created=${e.created_at}`);
        });
    } catch(e) {
        console.error('  ERROR:', e.message);
    }

    // 2. Inspect the full snapshot JSON for Oct
    console.log('\n[SNAPSHOT_DETAIL_OCT]');
    try {
        const snaps = await query('publicaciones_cuadrante',
            `select=*&hotel=eq.Sercotel Guadiana&semana_inicio=eq.${OCT_START}&estado=eq.activo&order=version.desc&limit=1`);
        if (!snaps.length) { console.log('  No snapshot found'); return; }
        const snap = snaps[0];
        const data = typeof snap.snapshot_json === 'string' ? JSON.parse(snap.snapshot_json) : (snap.snapshot_json || {});
        console.log('  id=' + snap.id);
        console.log('  version=' + snap.version);
        console.log('  created_at=' + snap.created_at);
        console.log('  snapshot_json type=' + typeof snap.snapshot_json);
        console.log('  snapshot_json top-level keys=' + Object.keys(data).join(','));
        const emps = data.empleados || data.rows || data.employees || [];
        console.log('  empleados.length=' + emps.length);
        if (emps.length > 0) {
            console.log('  First emp sample:', JSON.stringify(emps[0]).substring(0, 200));
        } else {
            // Try to find alternate structure
            console.log('  RAW snapshot_json preview (300 chars):', JSON.stringify(data).substring(0, 300));
        }
        // Check if snapshot_json is null vs empty
        console.log('  snapshot_json is null=' + (snap.snapshot_json === null));
        console.log('  snapshot_json falsy=' + (!snap.snapshot_json));
    } catch(e) {
        console.error('  ERROR:', e.message);
    }

    // 3. Also check all snapshots for Guadiana to understand versions
    console.log('\n[ALL_GUADIANA_OCT_SNAPSHOTS]');
    try {
        const allSnaps = await query('publicaciones_cuadrante',
            `select=id,hotel,semana_inicio,version,estado,created_at&hotel=eq.Sercotel Guadiana&semana_inicio=eq.${OCT_START}&order=version.desc`);
        console.log('  count=' + allSnaps.length);
        allSnaps.forEach(s => {
            console.log(`  v${s.version} id=${s.id.substring(0,8)} estado=${s.estado} created=${s.created_at}`);
        });
    } catch(e) {
        console.error('  ERROR:', e.message);
    }

    // 4. Check the ExcelRows / plantilla for Oct in any stored tables
    console.log('\n[PLANTILLA_OCT_CHECK]');
    try {
        const rows = await query('plantilla_excel',
            `select=*&hotel=eq.Sercotel Guadiana&semana_inicio=eq.${OCT_START}&limit=5`);
        console.log('  plantilla_excel rows for oct=' + rows.length);
    } catch(e) {
        console.log('  plantilla_excel not available:', e.message.substring(0,80));
    }
    try {
        const rows2 = await query('cuadrante_base',
            `select=*&hotel_id=eq.Sercotel Guadiana&limit=5`);
        console.log('  cuadrante_base rows=' + rows2.length);
    } catch(e) {
        console.log('  cuadrante_base not available:', e.message.substring(0,80));
    }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
