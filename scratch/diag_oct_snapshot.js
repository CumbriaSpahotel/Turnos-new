/**
 * Diagnose October 2026 snapshot status and all required checks.
 * Run: node scratch/diag_oct_snapshot.js
 * Requires supabase-config.js to export SUPABASE_URL and SUPABASE_ANON_KEY.
 */

const fs = require('fs');
const path = require('path');

// ---------- Read Supabase credentials from supabase-config.js ----------
const configRaw = fs.readFileSync(path.join(__dirname, '..', 'supabase-config.js'), 'utf8');
const urlMatch  = configRaw.match(/SUPABASE_URL\s*[=:]\s*['"`]([^'"`]+)/);
const keyMatch  = configRaw.match(/SUPABASE_ANON_KEY\s*[=:]\s*['"`]([^'"`]+)/);

if (!urlMatch || !keyMatch) {
    console.error('[DIAG] Could not parse SUPABASE_URL / SUPABASE_ANON_KEY from supabase-config.js');
    process.exit(1);
}
const SUPABASE_URL = urlMatch[1];
const SUPABASE_KEY = keyMatch[1];

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
};

async function query(table, params) {
    const qs = Object.entries(params)
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&');
    const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
    }
    return res.json();
}

async function main() {
    const OCT_START = '2026-10-19';
    const OCT_END   = '2026-10-25';
    const HOTEL     = 'Sercotel Guadiana';
    const TARGET_DATE = '2026-10-21';

    console.log('\n===== TURNOS WEB — OCTOBER 2026 DIAGNOSTIC =====\n');

    // ── 1. CHECK PUBLISHED SNAPSHOT ──────────────────────────────────────────
    console.log('[OCT_SNAPSHOT_PUBLICADO_CHECK]');
    let snapshot = null;
    try {
        const snaps = await query('publicaciones_cuadrante', {
            'select': '*',
            'hotel': `eq.${HOTEL}`,
            'semana_inicio': `eq.${OCT_START}`,
            'estado': 'eq.activo',
            'order': 'version.desc',
            'limit': '1'
        });
        if (snaps.length === 0) {
            console.log('  snapshotExiste=false');
            console.log('  hotel=' + HOTEL);
            console.log('  weekStart=' + OCT_START);
            console.log('  weekEnd=' + OCT_END);
            console.log('  CONCLUSION: Index/Mobile NO pueden mostrar oct-2026 porque no hay snapshot publicado.');
        } else {
            snapshot = snaps[0];
            const snData = typeof snapshot.snapshot_json === 'string'
                ? JSON.parse(snapshot.snapshot_json)
                : (snapshot.snapshot_json || {});
            const emps = snData.empleados || [];
            const daniEmp = emps.find(e =>
                (e.empleado_id || e.nombre || '').toLowerCase().includes('dani'));
            const proxEmp = emps.find(e =>
                (e.empleado_id || e.nombre || '').toLowerCase().includes('prox'));

            const daniCell = daniEmp ? (daniEmp.turnosOperativos || daniEmp.cells || daniEmp.dias || {})[TARGET_DATE] : null;
            const proxCell = proxEmp ? (proxEmp.turnosOperativos || proxEmp.cells || proxEmp.dias || {})[TARGET_DATE] : null;

            console.log('  snapshotExiste=true');
            console.log('  snapshotId=' + snapshot.id);
            console.log('  hotel=' + snapshot.hotel);
            console.log('  fechaPublicacion=' + (snapshot.created_at || snapshot.fecha_publicacion));
            console.log('  estado=' + snapshot.estado);
            console.log('  version=' + snapshot.version);
            console.log('  rowsCount=' + emps.length);
            console.log('  Dani_found=' + (daniEmp ? (daniEmp.empleado_id || daniEmp.nombre) : 'NOT FOUND'));
            console.log('  Dani_2026_10_21=' + JSON.stringify(daniCell || null));
            console.log('  Proximamente_found=' + (proxEmp ? (proxEmp.empleado_id || proxEmp.nombre) : 'NOT FOUND'));
            console.log('  Proximamente_2026_10_21=' + JSON.stringify(proxCell || null));

            const daniLabel = daniCell ? (daniCell.label || daniCell.code || daniCell.turno || '?') : '?';
            const proxLabel = proxCell ? (proxCell.label || proxCell.code || proxCell.turno || '?') : '?';
            const daniIcons = daniCell ? JSON.stringify(daniCell.icons || []) : '[]';
            const proxIcons = proxCell ? JSON.stringify(proxCell.icons || []) : '[]';
            console.log('  Dani_label=' + daniLabel);
            console.log('  Dani_icons=' + daniIcons);
            console.log('  Proximamente_label=' + proxLabel);
            console.log('  Proximamente_icons=' + proxIcons);

            const daniOk  = daniLabel.toLowerCase().includes('tarde') && daniIcons.includes('🔄');
            const proxOk  = proxLabel.toLowerCase().includes('ma') && proxIcons.includes('🔄');
            console.log('  Dani_CORRECT=' + daniOk + ' (expected: Tarde 🔄)');
            console.log('  Proximamente_CORRECT=' + proxOk + ' (expected: Mañana 🔄)');
        }
    } catch(e) {
        console.error('  ERROR:', e.message);
    }

    // ── 2. CHECK ACTIVE EVENTS (pending publication) ──────────────────────────
    console.log('\n[OCT_PENDING_PUBLICATION_CHECK]');
    try {
        const evts = await query('cambios_turno', {
            'select': '*',
            'fecha': `gte.${OCT_START}`,
            'fecha': `lte.${OCT_END}`,
            'order': 'created_at.desc'
        });
        const ACTIVE_STATES = ['activo','activa','aprobado','aprobada','pendiente'];
        const activeEvts = evts.filter(e => ACTIVE_STATES.includes((e.estado || '').toLowerCase()));
        const guadianaEvts = activeEvts.filter(e =>
            !e.hotel_origen || (e.hotel_origen || '').toLowerCase().includes('guadiana') ||
            (e.hotel_id || '').toLowerCase().includes('guadiana'));
        const daniEvt = guadianaEvts.find(e =>
            (e.empleado_id || e.origen || '').toLowerCase().includes('dani'));

        console.log('  hotel=' + HOTEL);
        console.log('  weekStart=' + OCT_START);
        console.log('  eventosActivos=' + activeEvts.length);
        console.log('  eventosGuadiana=' + guadianaEvts.length);
        console.log('  hasChanges=' + (guadianaEvts.length > 0));
        console.log('  targetEventFound=' + (daniEvt ? 'true' : 'false'));
        if (daniEvt) {
            console.log('  targetEventId=' + daniEvt.id);
            console.log('  targetOrigen=' + daniEvt.origen);
            console.log('  targetDestino=' + (daniEvt.destino || daniEvt.empleado_destino));
            console.log('  targetEstado=' + daniEvt.estado);
            console.log('  targetTipo=' + daniEvt.tipo);
            console.log('  targetFecha=' + daniEvt.fecha);
        }

        // Determine if there are events newer than last snapshot
        if (snapshot) {
            const snapDate = new Date(snapshot.created_at || snapshot.fecha_publicacion || 0);
            const newerEvts = guadianaEvts.filter(e => {
                const d = e.updated_at || e.created_at;
                return d && new Date(d) > snapDate;
            });
            console.log('  eventosPosterioresSnapshot=' + newerEvts.length);
            console.log('  cambiosPendientes=' + (newerEvts.length > 0 ? 'SI' : 'NO — snapshot ya incluye todo'));
        }
    } catch(e) {
        console.error('  ERROR querying cambios_turno:', e.message);
        // Try intercambios table
        try {
            const evts2 = await query('intercambios_turno', {
                'select': '*',
                'fecha': `gte.${OCT_START}`,
                'order': 'created_at.desc'
            });
            const active2 = evts2.filter(e => ['activo','activa','aprobado'].includes((e.estado||'').toLowerCase()));
            console.log('  (via intercambios_turno) activos=' + active2.length);
            active2.forEach(e => console.log('   ', e.estado, e.tipo, e.fecha, e.origen, '->', e.destino));
        } catch(e2) {
            console.error('  Also failed intercambios_turno:', e2.message);
        }
    }

    // ── 3. Required functions check ───────────────────────────────────────────
    console.log('\n[REQUIRED_FUNCTIONS_CHECK]');
    const adminJs = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
    const fns = [
        'window.cloneExcelRows',
        'window.publishToSupabase',
        'window.validatePublicationSnapshot',
        'window.buildPublicationSnapshotPreview',
        'window.hasPendingPublicationChanges',
        'window.validateSystemHealth',
        'window.showPublishPreview'
    ];
    fns.forEach(fn => {
        const regex = new RegExp(fn.replace(/\./g, '\\.') + '\\s*=');
        const count = (adminJs.match(regex) || []).length;
        console.log('  ' + fn + '=' + (count >= 1 ? 'EXISTS(defs=' + count + ')' : 'MISSING'));
    });

    // ── 4. Version check ──────────────────────────────────────────────────────
    console.log('\n[CACHE_VERSION_CHECK]');
    const idxHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const mobHtml = fs.readFileSync(path.join(__dirname, '..', 'live.mobile.html'), 'utf8');
    const swJs    = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
    const idxRule = idxHtml.match(/turnos-rules\.js\?v=([^"&\s]+)/);
    const mobRule = mobHtml.match(/turnos-rules\.js\?v=([^"&\s]+)/);
    const cacheN  = swJs.match(/CACHE_NAME\s*=\s*"([^"]+)"/);
    console.log('  index turnos-rules.js version=' + (idxRule ? idxRule[1] : 'NOT FOUND'));
    console.log('  mobile turnos-rules.js version=' + (mobRule ? mobRule[1] : 'NOT FOUND'));
    console.log('  service-worker CACHE_NAME=' + (cacheN ? cacheN[1] : 'NOT FOUND'));

    // ── 5. Descanso CSS in index ──────────────────────────────────────────────
    console.log('\n[INDEX_DESCANSO_CSS_CHECK]');
    const hasRedDescanso = idxHtml.includes('#fee2e2') && idxHtml.includes('v-d');
    const vdCssMatch = idxHtml.match(/\.v-d\b[^{]*\{[^}]+\}/);
    console.log('  v-d CSS found=' + (vdCssMatch ? 'YES' : 'NO'));
    console.log('  has red-soft #fee2e2=' + hasRedDescanso);
    if (vdCssMatch) console.log('  rule:', vdCssMatch[0].trim().substring(0, 100));

    // ── 6. Index renderCellContent shiftKey source ─────────────────────────────
    console.log('\n[INDEX_RENDER_SHIFT_KEY_CHECK]');
    const shiftKeyUsage = idxHtml.match(/shiftKey\([^)]+\)/g) || [];
    shiftKeyUsage.forEach(u => console.log('  usage:', u));
    const usesDisplayLabel = idxHtml.includes('display.label') && idxHtml.includes('shiftKey');
    console.log('  uses display.label for shiftKey=' + usesDisplayLabel);

    console.log('\n===== DIAGNOSTIC COMPLETE =====');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
