/**
 * Emergency surgical repair of admin.js:
 * 
 * Problem: Lines 5614-5617 contain JS code fragments that were accidentally 
 * injected into the modal HTML template literal, breaking the backtick string 
 * and causing syntax errors.
 * 
 * The modal HTML at L5611-5613 needs to be properly closed, followed by:
 * - modal footer HTML
 * - modal.classList.add('open');
 * - closing of showPublishPreview function
 * - window.cloneExcelRows definition
 * - beginning of window.publishToSupabase (which continues from L5619)
 * 
 * Looking at admin_clean.js for the reference structure.
 */
const fs = require('fs');
let c = fs.readFileSync('admin.js', 'utf8');
const lines = c.split('\n');

// Lines 5613 (L5613, 0-indexed: 5612) ends with `</div>\r`
// Lines 5614-5617 (0-indexed: 5613-5616) are the WRONG injected content
// Lines 5619-5638 (0-indexed: 5618-5637) is the rest of publishToSupabase body

// We need to:
// 1. Remove lines 5614-5617 (0-indexed 5613-5616) 
// 2. Replace them with correct modal closing HTML + window.cloneExcelRows + publishToSupabase header

// First verify the context
console.log('Verifying lines to fix:');
for (let i = 5611; i <= 5640; i++) {
    console.log('L'+(i+1)+':', lines[i].substring(0, 90));
}

// The broken section is lines 5613-5616 (0-indexed), which is:
// L5614: resumen: { emps: snap.rows.length },
// L5615: usuario: 'ADMIN'
// L5616: });
// L5617: }

// These should be replaced with the modal closing + cloneExcelRows + publishToSupabase start
const REPLACEMENT_LINES = [
`            </div>`,
``,
`            <footer style="padding: 24px 32px; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px;">`,
`                <button onclick="document.getElementById('\${modalId}').classList.remove('open')" style="padding: 12px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; font-weight: 700; cursor: pointer; color: #64748b;">Cancelar</button>`,
`                <button id="btnConfirmPublish" `,
`                        onclick="window.publishToSupabase()" `,
`                        \${!validation.ok ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}`,
`                        style="padding: 12px 32px; border: none; border-radius: 12px; background: #3b82f6; color: white; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">`,
`                    Confirmar y Publicar`,
`                </button>`,
`            </footer>`,
`        </div>`,
`    \`;`,
``,
`    modal.classList.add('open');`,
`};`,
``,
`// cloneExcelRows: deep clone seguro para filas Excel/Snapshot.`,
`// Preserva turno, code, label, icons, changed, intercambio, sustitucion,`,
`// empleado_id, hotel, fecha, semana_inicio, cells y todos los demas campos.`,
`window.cloneExcelRows = window.cloneExcelRows || function cloneExcelRows(rows) {`,
`    const data = rows != null ? rows : {};`,
`    try {`,
`        if (typeof structuredClone === 'function') return structuredClone(data);`,
`        return JSON.parse(JSON.stringify(data));`,
`    } catch (_cloneErr) {`,
`        if (Array.isArray(data)) return data.map(r => Object.assign({}, r));`,
`        if (typeof data === 'object') {`,
`            const out = {};`,
`            Object.keys(data).forEach(k => {`,
`                out[k] = Array.isArray(data[k]) ? data[k].map(r => Object.assign({}, r)) : data[k];`,
`            });`,
`            return out;`,
`        }`,
`        return data;`,
`    }`,
`};`,
``,
`window.publishToSupabase = async () => {`,
`    const btn = document.getElementById('btnConfirmPublish');`,
`    if (btn) {`,
`        btn.disabled = true;`,
`        btn.textContent = 'Publicando...';`,
`        btn.style.opacity = '0.7';`,
`    }`,
``,
`    // [PUBLISH_CLONE_CHECK]`,
`    console.log('[PUBLISH_CLONE_CHECK]', {`,
`        'typeof window.cloneExcelRows': typeof window.cloneExcelRows,`,
`        'typeof window._adminExcelEditableRows': typeof window._adminExcelEditableRows,`,
`        hasEditableRows: window._adminExcelEditableRows != null`,
`    });`,
``,
`    try {`,
`        const hotelSel = ($('#prevHotel'))?.value || 'all';`,
`        const rawDate = window._previewDate;`,
`        const base = new Date(rawDate + 'T12:00:00');`,
`        const weekStart = window.isoDate(window.getMonday(base));`,
``,
`        // 1. Generar Snapshots finales`,
`        const snapshots = await window.buildPublicationSnapshotPreview(weekStart, hotelSel);`,
`        `,
`        // 2. Sincronizar cambios de Excel (turnos crudos)`,
`        const changes = window.getExcelDiff ? window.getExcelDiff() : [];`,
`        if (changes.length > 0) {`,
`            const flatData = [];`,
`            changes.forEach(c => {`,
`                const dates = window.getFechasSemana(c.weekStart);`,
`                dates.forEach((f, i) => {`,
`                    if (c.row.values[i] !== c.orig.values[i]) {`,
`                        flatData.push({`,
`                            empleado_id: c.displayName,`,
`                            fecha: f,`,
`                            turno: c.row.values[i] || '',`,
`                            tipo: 'NORMAL',`,
`                            hotel_id: c.hotel`,
`                        });`,
`                    }`,
`                });`,
`            });`,
`            if (flatData.length > 0) {`,
`                await window.TurnosDB.bulkUpsert(flatData);`,
`                await window.TurnosDB.insertLog({`,
`                    cambios_totales: flatData.length,`,
`                    empleados_afectados: new Set(changes.map(c => c.displayName)).size,`,
`                    estado: 'ok'`,
`                });`,
`            }`,
`        }`,
``,
`        // 3. Guardar Snapshots en publicaciones_cuadrante`,
`        for (const snap of snapshots) {`,
`            await window.TurnosDB.publishCuadranteSnapshot({`,
`                semanaInicio: snap.week_start,`,
`                semanaFin: snap.week_end,`,
`                hotel: snap.hotel_id,`,
`                snapshot: snap,`,
`                resumen: { emps: snap.rows.length },`,
`                usuario: 'ADMIN'`,
`            });`,
`        }`,
``,
];

// Remove lines 5613-5617 (0-indexed, which is L5614-L5618)
// and the publishToSupabase header up to the try block open (L5619 onwards from L5618)
// But lines from L5619 onwards ARE the continuation of publishToSupabase body,
// starting with "// 4. Actualizar estado local"
// So we just need to fix lines 5613-5617 (0-indexed 5613, 5614, 5615, 5616)

const startFix = 5613; // 0-indexed (L5614: "resumen...")
const endFix = 5617;   // 0-indexed (L5618: blank line before "// 4.")

console.log('\nRemoving lines', startFix+1, 'to', endFix+1, 'and inserting repair block');
console.log('Lines being removed:');
for (let i = startFix; i <= endFix; i++) {
    console.log(' L'+(i+1)+':', lines[i].substring(0, 80));
}

// Replace those 5 lines with our full repair block
lines.splice(startFix, endFix - startFix + 1, ...REPLACEMENT_LINES);

c = lines.join('\n');
fs.writeFileSync('admin.js', c, 'utf8');
console.log('\nDone. New total lines:', c.split('\n').length);
console.log('File size:', fs.statSync('admin.js').size, 'bytes');
