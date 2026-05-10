/**
 * Inject hasPendingPublicationChanges into admin.js and wire it into showPublishPreview modal.
 *
 * Inserts the function BEFORE showPublishPreview and modifies the modal to show
 * "no pending changes" when appropriate.
 */
const fs = require('fs');
let c = fs.readFileSync('admin.js', 'utf8');
const lines = c.split('\n');

// 1. Find "window.showPublishPreview" line
let showPublishIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('window.showPublishPreview = async')) {
        showPublishIdx = i;
        break;
    }
}
if (showPublishIdx < 0) { console.error('showPublishPreview NOT FOUND'); process.exit(1); }
console.log('Found showPublishPreview at line', showPublishIdx + 1);

// 2. Insert hasPendingPublicationChanges BEFORE showPublishPreview
const hasPendingFn = [
`// hasPendingPublicationChanges: compara eventos activos vs ultimo snapshot publicado.`,
`// Devuelve {hasChanges, count, reason, lastSnapshotDate} por hotel/semana.`,
`window.hasPendingPublicationChanges = async function({ weekStart, weekEnd, hotels }) {`,
`    const result = { hasChanges: false, count: 0, events: [], reason: '', details: [] };`,
`    try {`,
`        const ACTIVE_STATES = ['activo','activa','aprobado','aprobada','pendiente'];`,
`        const allEvents = await window.TurnosDB.fetchEventos(weekStart, weekEnd);`,
`        const activeEvents = (allEvents || []).filter(e =>`,
`            ACTIVE_STATES.includes(String(e.estado || '').toLowerCase())`,
`        );`,
`        const hotelsToCheck = Array.isArray(hotels) ? hotels : (hotels ? [hotels] : []);`,
`        for (const hotel of hotelsToCheck) {`,
`            // Buscar ultimo snapshot publicado para este hotel/semana`,
`            const snapRes = await window.TurnosDB.client`,
`                .from('publicaciones_cuadrante')`,
`                .select('id, semana_inicio, hotel, created_at, version, estado')`,
`                .eq('estado', 'activo')`,
`                .eq('hotel', hotel)`,
`                .eq('semana_inicio', weekStart)`,
`                .order('version', { ascending: false })`,
`                .limit(1);`,
`            const lastSnap = snapRes.data?.[0];`,
`            const lastPubDate = lastSnap?.created_at ? new Date(lastSnap.created_at) : null;`,
`            // Eventos activos de este hotel o sin hotel especifico`,
`            const hotelEvents = activeEvents.filter(e => {`,
`                const evHotel = String(e.hotel_origen || e.hotel_id || '').trim();`,
`                return !evHotel || evHotel === hotel;`,
`            });`,
`            // Eventos posteriores al ultimo snapshot`,
`            let pendingEvents = hotelEvents;`,
`            if (lastPubDate) {`,
`                pendingEvents = hotelEvents.filter(e => {`,
`                    const evDate = e.updated_at || e.created_at;`,
`                    return evDate && new Date(evDate) > lastPubDate;`,
`                });`,
`            }`,
`            // Tambien contar si hay diff de Excel`,
`            const excelDiff = window.getExcelDiff ? window.getExcelDiff().length : 0;`,
`            const hotelPending = pendingEvents.length + excelDiff;`,
`            result.details.push({`,
`                hotel,`,
`                lastSnapshotId: lastSnap?.id || null,`,
`                lastSnapshotDate: lastSnap?.created_at || null,`,
`                lastSnapshotVersion: lastSnap?.version || null,`,
`                activeEventsTotal: hotelEvents.length,`,
`                pendingAfterSnapshot: pendingEvents.length,`,
`                excelDiff,`,
`                hasPending: hotelPending > 0`,
`            });`,
`            if (hotelPending > 0) {`,
`                result.hasChanges = true;`,
`                result.count += hotelPending;`,
`                result.events.push(...pendingEvents);`,
`            }`,
`        }`,
`        // Si no se especificaron hoteles, contar todos los eventos activos sin filtro`,
`        if (hotelsToCheck.length === 0) {`,
`            result.hasChanges = activeEvents.length > 0;`,
`            result.count = activeEvents.length;`,
`            result.events = activeEvents;`,
`        }`,
`        result.reason = result.hasChanges`,
`            ? \`\${result.count} cambio(s) pendiente(s) de publicar\``,
`            : 'No hay cambios pendientes de publicacion';`,
`        console.log('[PUBLISH_PENDING_CHECK]', {`,
`            weekStart, weekEnd,`,
`            hotels: hotelsToCheck,`,
`            hasChanges: result.hasChanges,`,
`            count: result.count,`,
`            details: result.details`,
`        });`,
`    } catch (err) {`,
`        console.error('[PUBLISH_PENDING_CHECK] Error:', err);`,
`        // En caso de error, permitir publicar (fail-open para no bloquear al admin)`,
`        result.hasChanges = true;`,
`        result.reason = 'No se pudo verificar cambios pendientes (permitiendo publicar)';`,
`    }`,
`    return result;`,
`};`,
``,
];

lines.splice(showPublishIdx, 0, ...hasPendingFn);
console.log('Inserted hasPendingPublicationChanges (' + hasPendingFn.length + ' lines) before showPublishPreview');

// 3. Now find the modal HTML section and add pending-changes check.
// After insertion, showPublishPreview moved down by hasPendingFn.length lines.
// Find the line with "// 3. Validar Snapshot" and add pending check before it.
let validarIdx = -1;
for (let i = showPublishIdx + hasPendingFn.length; i < lines.length; i++) {
    if (lines[i].includes('// 3. Validar Snapshot')) {
        validarIdx = i;
        break;
    }
}
if (validarIdx < 0) { console.error('Validar Snapshot comment NOT FOUND'); process.exit(1); }
console.log('Found "// 3. Validar Snapshot" at line', validarIdx + 1);

// Insert pending changes check BEFORE validation step 3
const pendingCheckBlock = [
`    // 2.5. Verificar cambios pendientes de publicacion`,
`    const hotelsInPreview = snapshots.map(s => s.hotel_nombre || s.hotel_id);`,
`    const pendingResult = await window.hasPendingPublicationChanges({`,
`        weekStart, weekEnd,`,
`        hotels: hotelsInPreview`,
`    });`,
``,
];
lines.splice(validarIdx, 0, ...pendingCheckBlock);
console.log('Inserted pending check block before validation');

// 4. Find the footer with "Confirmar y Publicar" and make it conditional
// The button should be disabled if !validation.ok OR !pendingResult.hasChanges
let footerIdx = -1;
for (let i = validarIdx + pendingCheckBlock.length; i < lines.length; i++) {
    if (lines[i].includes("${!validation.ok ?")) {
        footerIdx = i;
        break;
    }
}
if (footerIdx < 0) { console.error('Footer button condition NOT FOUND'); process.exit(1); }
console.log('Found button disable condition at line', footerIdx + 1);

// Replace the condition to also check pendingResult
const oldCondition = "${!validation.ok ? 'disabled style=\"opacity: 0.5; cursor: not-allowed;\"' : ''}";
const newCondition = "${(!validation.ok || !pendingResult.hasChanges) ? 'disabled style=\"opacity: 0.5; cursor: not-allowed;\"' : ''}";
lines[footerIdx] = lines[footerIdx].replace(oldCondition, newCondition);

// Also change "Confirmar y Publicar" to show context
let publishBtnTextIdx = -1;
for (let i = footerIdx; i < footerIdx + 5; i++) {
    if (lines[i] && lines[i].includes('Confirmar y Publicar')) {
        publishBtnTextIdx = i;
        break;
    }
}
if (publishBtnTextIdx >= 0) {
    lines[publishBtnTextIdx] = lines[publishBtnTextIdx].replace(
        'Confirmar y Publicar',
        '${pendingResult.hasChanges ? "Confirmar y Publicar" : "Sin cambios pendientes"}'
    );
    console.log('Updated button text to be conditional');
}

// 5. Add a "no pending changes" info box after warningsHtml in the modal
// Find where warningsHtml is used and add pending info after it
let warningsHtmlUseIdx = -1;
for (let i = validarIdx; i < lines.length; i++) {
    if (lines[i].includes('${warningsHtml}')) {
        warningsHtmlUseIdx = i;
        break;
    }
}
if (warningsHtmlUseIdx >= 0) {
    const pendingInfoBlock = [
`                \${!pendingResult.hasChanges ? \``,
`                <div style="background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; padding: 16px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">`,
`                    <i class="fas fa-info-circle" style="font-size: 1.2rem;"></i>`,
`                    <div>`,
`                        <strong style="display: block;">Sin cambios pendientes de publicaci\\u00f3n</strong>`,
`                        <span style="font-size: 0.85rem;">La semana seleccionada ya est\\u00e1 publicada y no existen cambios activos nuevos.</span>`,
`                    </div>`,
`                </div>\` : (pendingResult.count > 0 ? \``,
`                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 16px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">`,
`                    <i class="fas fa-sync-alt" style="font-size: 1.1rem;"></i>`,
`                    <div>`,
`                        <strong style="display: block;">Cambios pendientes: \${pendingResult.count}</strong>`,
`                        <span style="font-size: 0.85rem;">\${pendingResult.reason}</span>`,
`                    </div>`,
`                </div>\` : '')}`,
    ];
    lines.splice(warningsHtmlUseIdx + 1, 0, ...pendingInfoBlock);
    console.log('Inserted pending info box after warningsHtml');
}

c = lines.join('\n');
fs.writeFileSync('admin.js', c, 'utf8');
console.log('\nDone. New line count:', c.split('\n').length);
