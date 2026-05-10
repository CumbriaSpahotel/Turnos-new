/**
 * Inspect snapshot rows key for October 2026 and check the 2026-10-21 exchange.
 * Also discover the correct column for eventos_cuadrante date filter.
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
    const TARGET_DATE = '2026-10-21';
    const HOTEL = 'Sercotel Guadiana';

    console.log('\n===== SNAPSHOT ROWS ANALYSIS =====\n');

    // 1. Get the snapshot
    const snaps = await query('publicaciones_cuadrante',
        `select=*&hotel=eq.${encodeURIComponent(HOTEL)}&semana_inicio=eq.${OCT_START}&estado=eq.activo&order=version.desc&limit=1`);
    
    if (!snaps.length) { console.log('No snapshot found'); return; }
    const snap = snaps[0];
    const data = typeof snap.snapshot_json === 'string' ? JSON.parse(snap.snapshot_json) : snap.snapshot_json;
    
    const rows = data.rows || data.empleados || [];
    console.log('[SNAPSHOT_ROWS_OCT]');
    console.log('  snapshotId=' + snap.id);
    console.log('  version=' + snap.version);
    console.log('  created_at=' + snap.created_at);
    console.log('  rows.length=' + rows.length);
    
    rows.forEach((row, i) => {
        const empId = row.empleado_id || row.nombre || row.id || ('row_' + i);
        const dayCell = (row.dias || row.turnosOperativos || row.cells || {})[TARGET_DATE];
        const dayLabel = dayCell ? (dayCell.label || dayCell.code || '?') : 'NO DATA';
        const dayIcons = dayCell ? JSON.stringify(dayCell.icons || []) : '[]';
        const changed = dayCell ? dayCell.changed : false;
        console.log(`  [${i}] ${empId} | ${TARGET_DATE}: ${dayLabel} icons=${dayIcons} changed=${changed}`);
    });

    // Look specifically for Dani
    const dani = rows.find(r => (r.empleado_id || r.nombre || '').toLowerCase().includes('dani'));
    const prox = rows.find(r => {
        const n = (r.empleado_id || r.nombre || '').toLowerCase();
        return n.includes('prox') || n.includes('proxim');
    });
    
    console.log('\n[OCT_SNAPSHOT_TARGET_CELLS]');
    if (dani) {
        const cell = (dani.dias || {})[TARGET_DATE];
        console.log('  Dani empId=' + (dani.empleado_id || dani.nombre));
        console.log('  Dani ' + TARGET_DATE + '=' + JSON.stringify(cell || 'NOT IN SNAPSHOT'));
    } else {
        console.log('  Dani=NOT FOUND IN SNAPSHOT');
        console.log('  Available emp IDs:', rows.map(r => r.empleado_id || r.nombre).join(', '));
    }
    
    if (prox) {
        const cell = (prox.dias || {})[TARGET_DATE];
        console.log('  Proximamente empId=' + (prox.empleado_id || prox.nombre));
        console.log('  Proximamente ' + TARGET_DATE + '=' + JSON.stringify(cell || 'NOT IN SNAPSHOT'));
    } else {
        console.log('  Proximamente=NOT FOUND IN SNAPSHOT');
    }

    // 2. Discover eventos_cuadrante columns
    console.log('\n[EVENTOS_CUADRANTE_SCHEMA]');
    try {
        const evtsAll = await query('eventos_cuadrante', `select=*&limit=1`);
        if (evtsAll.length) {
            console.log('  columns:', Object.keys(evtsAll[0]).join(', '));
        } else {
            console.log('  No records found in eventos_cuadrante');
        }
    } catch(e) {
        console.log('  Error:', e.message.substring(0, 100));
    }

    // 3. Query eventos for Oct range using correct fields
    console.log('\n[EVENTOS_CUADRANTE_OCT]');
    try {
        // First get schema
        const evtSample = await query('eventos_cuadrante', `select=*&limit=1&order=created_at.desc`);
        const cols = evtSample.length ? Object.keys(evtSample[0]) : [];
        console.log('  Available columns:', cols.join(', '));
        
        // Find date columns
        const dateCol = cols.find(c => c.includes('fecha') || c.includes('date') || c.includes('start') || c.includes('inicio'));
        console.log('  Using date column:', dateCol);
        
        if (dateCol) {
            const evts = await query('eventos_cuadrante',
                `select=*&${dateCol}=gte.${OCT_START}&${dateCol}=lte.2026-10-25&order=created_at.desc`);
            const ACTIVE = ['activo','activa','aprobado','aprobada','pendiente'];
            const active = evts.filter(e => ACTIVE.includes((e.estado||'').toLowerCase()));
            console.log('  eventosTotal=' + evts.length + ' activos=' + active.length);
            active.forEach((e, i) => {
                console.log(`  [${i+1}] ${e.tipo} ${e.estado} ${e[dateCol]} emp=${e.empleado_id||e.origen||'?'} dest=${e.empleado_destino||e.destino||'n/a'}`);
            });
        }
    } catch(e) {
        console.log('  Error:', e.message.substring(0, 150));
    }

    // 4. Check mobile renderSnapshotTable uses 'rows' vs 'empleados'
    console.log('\n[MOBILE_SNAPSHOT_KEY_CHECK]');
    const mobileJs = fs.readFileSync(path.join(__dirname, '..', 'mobile.app.js'), 'utf8');
    const usesEmpleados = mobileJs.includes('snapshotData.empleados');
    const usesRows = mobileJs.includes('snapshotData.rows') || mobileJs.includes('|| []');
    const empLine = mobileJs.match(/const empleados = [^\n]+/);
    console.log('  mobile uses snapshotData.empleados=' + usesEmpleados);
    console.log('  actual line:', empLine ? empLine[0].trim() : 'NOT FOUND');
    console.log('  snapshot_json actual key=rows');
    console.log('  MISMATCH=' + (usesEmpleados && !mobileJs.includes('.rows')));
    
    // 5. Check loadPublishedSchedule in supabase-dao for key mapping
    console.log('\n[DAO_SNAPSHOT_KEY_MAPPING]');
    const daoJs = fs.readFileSync(path.join(__dirname, '..', 'supabase-dao.js'), 'utf8');
    const loadPubSection = daoJs.substring(daoJs.indexOf('loadPublishedSchedule'), 
        daoJs.indexOf('loadPublishedSchedule') + 3000);
    const empleadosInDao = (loadPubSection.match(/empleados|rows|\.data/g) || []).slice(0, 10);
    console.log('  Key references in loadPublishedSchedule:', empleadosInDao.join(', '));
    const snapshotDataLine = loadPubSection.match(/snapshot_json.*|data\s*[:=]/g) || [];
    console.log('  snapshot_json handling:', snapshotDataLine.slice(0, 3).join(' | '));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
