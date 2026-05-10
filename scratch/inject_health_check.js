/**
 * Inject validateSystemHealth, global error capture, and 
 * make the dashboard "Operación Estable" conditional.
 */
const fs = require('fs');
let c = fs.readFileSync('admin.js', 'utf8');
const lines = c.split('\n');

// 1. Find "window.renderDashboard" to inject validateSystemHealth BEFORE it
let renderDashIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('window.renderDashboard = async')) {
        renderDashIdx = i;
        break;
    }
}
if (renderDashIdx < 0) { console.error('renderDashboard NOT FOUND'); process.exit(1); }
console.log('Found renderDashboard at L' + (renderDashIdx + 1));

// 2. Insert global error capture + validateSystemHealth + visual rules check BEFORE renderDashboard
const healthBlock = [
`// ─── Global Error Capture ───────────────────────────────────────────────────`,
`window.__APP_ERRORS__ = window.__APP_ERRORS__ || [];`,
`window.addEventListener('error', (evt) => {`,
`    window.__APP_ERRORS__.push({ ts: Date.now(), type: 'error', msg: evt.message, file: evt.filename, line: evt.lineno });`,
`    if (window.__APP_ERRORS__.length > 50) window.__APP_ERRORS__.shift();`,
`});`,
`window.addEventListener('unhandledrejection', (evt) => {`,
`    const msg = evt.reason?.message || String(evt.reason || 'Unknown rejection');`,
`    window.__APP_ERRORS__.push({ ts: Date.now(), type: 'rejection', msg });`,
`    if (window.__APP_ERRORS__.length > 50) window.__APP_ERRORS__.shift();`,
`});`,
``,
`// ─── Visual Rules Health Check ──────────────────────────────────────────────`,
`window.checkVisualRulesHealth = function() {`,
`    const results = { ok: true, issues: [] };`,
`    if (!window.TurnosRules) {`,
`        results.ok = false;`,
`        results.issues.push('TurnosRules no cargado');`,
`        return results;`,
`    }`,
`    const TR = window.TurnosRules;`,
`    const tests = [`,
`        { input: { code: 'BAJA', type: 'BAJA' }, expect: /Baja.*\\u{1FA7A}/u, name: 'Baja 🩺' },`,
`        { input: { code: 'PERM', type: 'PERM' }, expect: /Permiso.*\\u{1F5D3}/u, name: 'Permiso 🗓️' },`,
`        { input: { code: 'N', type: 'NORMAL' }, expect: /Noche/i, name: 'Noche label' },`,
`        { input: { code: 'D', type: 'NORMAL' }, expect: /Descanso/i, name: 'Descanso label' },`,
`        { input: { code: 'VAC', type: 'VAC' }, expect: /Vacaciones/i, name: 'Vacaciones label' },`,
`    ];`,
`    tests.forEach(t => {`,
`        try {`,
`            const d = TR.getPublicCellDisplay(t.input, { compact: false });`,
`            if (!t.expect.test(d.text || d.label || '')) {`,
`                results.ok = false;`,
`                results.issues.push('Regla visual rota: ' + t.name + ' => got "' + (d.label || '') + '"');`,
`            }`,
`        } catch(e) {`,
`            results.ok = false;`,
`            results.issues.push('Error en test ' + t.name + ': ' + e.message);`,
`        }`,
`    });`,
`    // Descanso class check`,
`    try {`,
`        const dk = TR.shiftKey('D', 'NORMAL');`,
`        if (dk !== 'd') {`,
`            results.ok = false;`,
`            results.issues.push('Descanso shiftKey devuelve "' + dk + '" en vez de "d"');`,
`        }`,
`    } catch(e) {}`,
`    console.log('[VISUAL_RULES_HEALTH]', results);`,
`    return results;`,
`};`,
``,
`// ─── validateSystemHealth ───────────────────────────────────────────────────`,
`window.validateSystemHealth = async function(weekStart, weekEnd) {`,
`    const health = {`,
`        ok: true,`,
`        criticals: [],`,
`        warnings: [],`,
`        info: [],`,
`        pendingChanges: 0,`,
`        auditContext: { weekStart, weekEnd, source: 'dashboard', ts: new Date().toISOString() }`,
`    };`,
`    try {`,
`        // 1. Pending changes`,
`        if (window.hasPendingPublicationChanges) {`,
`            const hotels = ['Sercotel Guadiana', 'Cumbria Spa&Hotel'];`,
`            const pend = await window.hasPendingPublicationChanges({ weekStart, weekEnd, hotels });`,
`            health.pendingChanges = pend.count;`,
`            if (pend.count > 0) {`,
`                health.ok = false;`,
`                health.warnings.push(pend.count + ' cambio(s) pendiente(s) de publicar');`,
`            }`,
`            health.auditContext.pendingDetails = pend.details;`,
`        }`,
``,
`        // 2. JS errors`,
`        const recentErrors = (window.__APP_ERRORS__ || []).filter(e => Date.now() - e.ts < 300000);`,
`        if (recentErrors.length > 0) {`,
`            health.ok = false;`,
`            const criticalPatterns = ['is not a function', 'ReferenceError', 'SyntaxError', 'Cannot access', 'fecha=lte.null'];`,
`            recentErrors.forEach(err => {`,
`                const isCritical = criticalPatterns.some(p => (err.msg || '').includes(p));`,
`                if (isCritical) {`,
`                    health.criticals.push('Error JS: ' + (err.msg || '').substring(0, 80));`,
`                } else {`,
`                    health.warnings.push('Error JS: ' + (err.msg || '').substring(0, 80));`,
`                }`,
`            });`,
`        }`,
``,
`        // 3. Visual rules`,
`        const vr = window.checkVisualRulesHealth();`,
`        if (!vr.ok) {`,
`            health.ok = false;`,
`            vr.issues.forEach(issue => health.criticals.push(issue));`,
`        }`,
``,
`        // 4. Required functions`,
`        const requiredFns = ['cloneExcelRows', 'publishToSupabase', 'validatePublicationSnapshot',`,
`            'buildPublicationSnapshotPreview', 'showPublishPreview'];`,
`        requiredFns.forEach(fn => {`,
`            if (typeof window[fn] !== 'function') {`,
`                health.ok = false;`,
`                health.criticals.push('Funcion obligatoria inexistente: ' + fn);`,
`            }`,
`        });`,
``,
`        // 5. TurnosRules loaded`,
`        if (!window.TurnosRules) {`,
`            health.ok = false;`,
`            health.criticals.push('TurnosRules no cargado');`,
`        }`,
``,
`        // 6. Supabase connection`,
`        if (!window.TurnosDB) {`,
`            health.ok = false;`,
`            health.criticals.push('TurnosDB no inicializado');`,
`        }`,
``,
`        console.log('[HEALTH_CONTEXT]', health.auditContext);`,
`    } catch (err) {`,
`        health.ok = false;`,
`        health.criticals.push('Error en validateSystemHealth: ' + err.message);`,
`    }`,
`    return health;`,
`};`,
``,
];

lines.splice(renderDashIdx, 0, ...healthBlock);
console.log('Inserted health block (' + healthBlock.length + ' lines) before renderDashboard');

// 3. Now find the "Operación Estable" block and make it conditional
// After insertion, lines shifted by healthBlock.length
const stableSearchStart = renderDashIdx + healthBlock.length;
let stableIdx = -1;
for (let i = stableSearchStart; i < lines.length; i++) {
    if (lines[i].includes("Operación Estable") && lines[i].includes("alert-title")) {
        stableIdx = i;
        break;
    }
}
if (stableIdx < 0) { console.error('"Operación Estable" NOT FOUND'); process.exit(1); }
console.log('Found "Operación Estable" at L' + (stableIdx + 1));

// Find the parent `if (allRisks.length === 0)` block — it starts a few lines before stableIdx
let ifAllRisksIdx = -1;
for (let i = stableIdx - 5; i <= stableIdx; i++) {
    if (lines[i] && lines[i].includes('allRisks.length === 0')) {
        ifAllRisksIdx = i;
        break;
    }
}
if (ifAllRisksIdx < 0) { console.error('allRisks.length === 0 NOT FOUND'); process.exit(1); }
console.log('Found allRisks.length===0 check at L' + (ifAllRisksIdx + 1));

// Find the closing of the "Operación Estable" block (the `;` after the template literal closing)
// It should be the line with just `};` or `            `;`
let stableEndIdx = -1;
for (let i = stableIdx; i < stableIdx + 10; i++) {
    if (lines[i] && lines[i].trim() === '`;') {
        stableEndIdx = i;
        break;
    }
}
if (stableEndIdx < 0) { console.error('End of Operación Estable block NOT FOUND'); process.exit(1); }
console.log('Found Operación Estable end at L' + (stableEndIdx + 1));

// Now I need to add a health check call inside renderDashboard.
// Find the line right after the conflicts + allRisks block setup and BEFORE the riskContainer rendering
// Insert health check call after allRisks is built (after plaza pendiente block)
let plazaEndIdx = -1;
for (let i = stableSearchStart; i < lines.length; i++) {
    if (lines[i] && lines[i].includes("if (riskContainer)")) {
        plazaEndIdx = i;
        break;
    }
}
if (plazaEndIdx < 0) { console.error('riskContainer check NOT FOUND'); process.exit(1); }
console.log('Found riskContainer check at L' + (plazaEndIdx + 1));

// Insert health check call BEFORE riskContainer rendering
const healthCallBlock = [
``,
`        // --- HEALTH CHECK: validateSystemHealth + pending changes ---`,
`        const _healthWeekStart = window._previewDate`,
`            ? (window.isoDate ? window.isoDate(window.getMonday(new Date(window._previewDate + 'T12:00:00'))) : window._previewDate)`,
`            : today;`,
`        const _healthWeekEnd = window.addIsoDays ? window.addIsoDays(_healthWeekStart, 6) : _healthWeekStart;`,
`        const systemHealth = await window.validateSystemHealth(_healthWeekStart, _healthWeekEnd);`,
``,
`        // Merge health criticals/warnings into allRisks`,
`        systemHealth.criticals.forEach(msg => {`,
`            allRisks.push({ severity: 'critical', type: 'SYSTEM_HEALTH', title: 'Problema del Sistema', desc: msg });`,
`            counts.critical++;`,
`        });`,
`        systemHealth.warnings.forEach(msg => {`,
`            allRisks.push({ severity: 'warning', type: 'SYSTEM_HEALTH', title: 'Aviso del Sistema', desc: msg });`,
`            counts.warning++;`,
`        });`,
``,
];
lines.splice(plazaEndIdx, 0, ...healthCallBlock);
console.log('Inserted health call block before riskContainer');

// After this insertion, the "Operación Estable" shifted again
const shift2 = healthCallBlock.length;

// Re-find the "allRisks.length === 0" line after the shift
let newStableCheckIdx = -1;
for (let i = plazaEndIdx + shift2; i < lines.length; i++) {
    if (lines[i] && lines[i].includes('allRisks.length === 0')) {
        newStableCheckIdx = i;
        break;
    }
}
if (newStableCheckIdx < 0) { console.error('Re-find allRisks.length===0 FAILED'); process.exit(1); }

// Also need to replace the "Operación Estable" description to be conditional on pendingChanges
// Find the "No se han detectado conflictos" line
let noConflictsIdx = -1;
for (let i = newStableCheckIdx; i < newStableCheckIdx + 10; i++) {
    if (lines[i] && lines[i].includes('No se han detectado conflictos')) {
        noConflictsIdx = i;
        break;
    }
}
if (noConflictsIdx >= 0) {
    // The allRisks.length === 0 condition already handles this properly because
    // we merged health warnings/criticals into allRisks above.
    // If pendingChanges > 0, a warning was added to allRisks, so allRisks.length > 0.
    // So "Operación Estable" will ONLY show when allRisks is truly empty (no criticals, no warnings, no pending).
    console.log('Operación Estable is already conditional - pending changes inject warnings into allRisks');
}

c = lines.join('\n');
fs.writeFileSync('admin.js', c, 'utf8');
console.log('\nDone. New line count:', c.split('\n').length);
