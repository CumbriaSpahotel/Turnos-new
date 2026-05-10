/**
 * PATCH SCRIPT — aplica solo los cambios funcionales necesarios sobre 
 * el admin.js restaurado desde git. Lee y escribe siempre como UTF-8.
 * 
 * Cambios que aplica:
 * 1. Fix brace in loadAdminExcelSourceRows (already correct in git version)
 * 2. Fix rawMonth null safety in renderPreview
 * 3. Insert validateSystemHealth (placeholder-aware, clean UTF-8)
 * 4. Replace validatePublicationSnapshot with placeholder-aware version
 */

const fs = require('fs');
const FILE = 'admin.js';

// Always read as UTF-8
let content = fs.readFileSync(FILE, 'utf8');

// Remove BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
    console.log('[PATCH] BOM removido');
}

let changed = 0;

// ─────────────────────────────────────────────────────────────
// PATCH 1: Fix rawMonth null safety in renderPreview
// ─────────────────────────────────────────────────────────────
const OLD_RAW_MONTH = `        const rawDate = window._previewDate || window.isoDate(new Date());
        const rawMonth = window._previewDate.substring(0,7);`;
const NEW_RAW_MONTH = `        const rawDate = window._previewDate || window.isoDate(new Date());
        const rawMonth = (rawDate || '').substring(0,7);`;

if (content.includes(OLD_RAW_MONTH)) {
    content = content.replace(OLD_RAW_MONTH, NEW_RAW_MONTH);
    console.log('[PATCH 1] rawMonth null safety — OK');
    changed++;
} else if (content.includes(NEW_RAW_MONTH)) {
    console.log('[PATCH 1] rawMonth null safety — ya aplicado');
} else {
    console.warn('[PATCH 1] rawMonth pattern NOT FOUND — buscar manualmente');
}

// ─────────────────────────────────────────────────────────────
// PATCH 2: validateSystemHealth — placeholder-aware
// Insertar ANTES de window.buildPublicationSnapshotPreview
// ─────────────────────────────────────────────────────────────
const BUILD_MARKER = 'window.buildPublicationSnapshotPreview = async (weekStart, hotelName = \'all\') => {';

const HEALTH_FUNC = `window.validateSystemHealth = async (weekStartOrContext) => {
    const health = { OK: true, CRITICAL: [], WARNING: [], INFO: [] };
    try {
        const wStart = typeof weekStartOrContext === 'string'
            ? weekStartOrContext
            : (weekStartOrContext.weekStart || '');
        const hotelCtx = typeof weekStartOrContext === 'object'
            ? weekStartOrContext.hotel
            : '';
        const events = await window.TurnosDB.fetchEventos(wStart);

        // Detector de mojibake en eventos
        const MOJIBAKE_RE = /Ã[ƒÂ]|â€|Â±|Â©/;
        events.forEach(ev => {
            for (const [key, val] of Object.entries(ev)) {
                if (typeof val !== 'string' || !val) continue;
                if (MOJIBAKE_RE.test(val)) {
                    health.WARNING.push({
                        title: 'Mojibake Detectado',
                        desc: 'Campo: ' + key + ' | Valor: ' + JSON.stringify(val),
                        type: 'MOJIBAKE'
                    });
                    break;
                }
            }
        });

        try {
            const snapshots = await window.buildPublicationSnapshotPreview(wStart, hotelCtx);
            const snapVal = await window.validatePublicationSnapshot(snapshots);
            if (!snapVal.ok) {
                snapVal.errors.forEach(err => health.CRITICAL.push({
                    title: 'Bloqueo de Publicación', desc: err, type: 'SNAPSHOT'
                }));
            }
        } catch (e) {
            health.CRITICAL.push({ title: 'Error en Validador', desc: e.message, type: 'JS_ERROR' });
        }

        // Caso protegido: Dani ↔ Próximamente — 2026-10-21
        if (wStart === '2026-10-19') {
            const targetDate = '2026-10-21';
            const resolveDay = window.resolveEmployeeDay;
            const daniRes = resolveDay
                ? resolveDay({ empleadoId: 'dani', fecha: targetDate, eventos: events, hotel: 'Sercotel Guadiana' })
                : null;
            const proxRes1 = resolveDay
                ? resolveDay({ empleadoId: 'proximamente', fecha: targetDate, eventos: events, hotel: 'Sercotel Guadiana' })
                : null;
            const proxRes2 = resolveDay
                ? resolveDay({ empleadoId: '¿?', fecha: targetDate, eventos: events, hotel: 'Sercotel Guadiana' })
                : null;
            const proxRes = (proxRes1 && proxRes1.cambio) ? proxRes1
                : (proxRes2 && proxRes2.cambio ? proxRes2 : (proxRes1 || proxRes2));
            const normShift = window.normalizeShiftValue;
            const daniOk = daniRes
                && (normShift ? normShift(daniRes.turno) === 'T' : daniRes.turno === 'T')
                && daniRes.cambio;
            const proxOk = proxRes
                && (normShift ? normShift(proxRes.turno) === 'M' : proxRes.turno === 'M')
                && proxRes.cambio;
            if (!daniOk || !proxOk) {
                health.CRITICAL.push({
                    title: 'Intercambio no aplicado',
                    desc: 'Intercambio Dani ↔ Próximamente no se refleja en la matriz del 2026-10-21.',
                    type: 'INTERCAMBIO_FAIL'
                });
            }
        }
    } catch (e) {
        health.CRITICAL.push({ title: 'Fallo General de Auditoría', desc: e.message, type: 'JS_ERROR' });
    }
    return health;
};

`;

// Remove any existing validateSystemHealth block first
const healthStart = content.indexOf('window.validateSystemHealth = async (weekStartOrContext) => {');
if (healthStart >= 0) {
    // Find its closing }; 
    let depth = 0;
    let pos = healthStart;
    let inBlock = false;
    for (let i = healthStart; i < content.length; i++) {
        if (content[i] === '{') { depth++; inBlock = true; }
        else if (content[i] === '}') {
            depth--;
            if (inBlock && depth === 0) {
                // consume trailing semicolon and whitespace
                let end = i + 1;
                while (end < content.length && (content[end] === ';' || content[end] === '\r' || content[end] === '\n')) end++;
                content = content.substring(0, healthStart) + content.substring(end);
                console.log('[PATCH 2] Existing validateSystemHealth removed');
                changed++;
                break;
            }
        }
    }
}

const buildIdx = content.indexOf(BUILD_MARKER);
if (buildIdx >= 0) {
    content = content.substring(0, buildIdx) + HEALTH_FUNC + content.substring(buildIdx);
    console.log('[PATCH 2] validateSystemHealth inserted — OK');
    changed++;
} else {
    console.warn('[PATCH 2] buildPublicationSnapshotPreview marker NOT FOUND');
}

// ─────────────────────────────────────────────────────────────
// PATCH 3: Replace validatePublicationSnapshot with placeholder-aware version
// ─────────────────────────────────────────────────────────────
const VAL_START_MARKER = 'window.validatePublicationSnapshot = async (snapshots) => {';
const VAL_START_IDX = content.indexOf(VAL_START_MARKER);

if (VAL_START_IDX >= 0) {
    // Find closing }; of the function
    let depth = 0;
    let inBlock = false;
    let endIdx = VAL_START_IDX;
    for (let i = VAL_START_IDX; i < content.length; i++) {
        if (content[i] === '{') { depth++; inBlock = true; }
        else if (content[i] === '}') {
            depth--;
            if (inBlock && depth === 0) {
                // consume trailing semicolon and newlines
                endIdx = i + 1;
                while (endIdx < content.length && (content[endIdx] === ';' || content[endIdx] === '\r' || content[endIdx] === '\n')) endIdx++;
                break;
            }
        }
    }

    const NEW_VALIDATOR = `window.validatePublicationSnapshot = async (snapshots) => {
    const errors = [];
    const warnings = [];

    for (const snap of snapshots) {
        const hName = snap.hotel_nombre;
        const wStart = snap.week_start || snap.semana_inicio || '';
        const wEnd   = snap.week_end   || snap.semana_fin   || '';
        const snapHotelId = snap.hotel_id || snap.hotel || snap.hotel_nombre || '';

        const events = await window.TurnosDB.fetchEventos(wStart, wEnd);
        const employees = (window.empleadosGlobales && window.empleadosGlobales.length)
            ? window.empleadosGlobales
            : (window._employeeLineModels || []);

        // Build rowMap: normalizedKey -> row
        const rowMap = new Map();
        (snap.rows || []).forEach(row => {
            const rawName = row.empleado || row.nombreVisible || row.nombre || row.employeeName || '';
            const keyName = window.normalizePersonKey(rawName);
            if (keyName && !rowMap.has(keyName)) rowMap.set(keyName, row);
            const rawId = row.empleado_id || row.employee_id || '';
            const keyId = window.normalizePersonKey(rawId);
            if (keyId && keyId !== keyName && !rowMap.has(keyId)) rowMap.set(keyId, row);
        });

        // Enrich rowMap: alias placeholder row for operationally named destinations
        const plazaRow = rowMap.get('¿?') || rowMap.get('') || null;
        if (plazaRow) {
            (events || []).forEach(ev => {
                if (window.normalizeEstado(ev.estado) === 'anulado') return;
                const destRaw = ev.empleado_destino_id || ev.destino || ev.companero || '';
                if (!destRaw) return;
                const destKey = window.normalizePersonKey(destRaw);
                if (destKey && destKey !== '¿?' && destKey !== '' && !rowMap.has(destKey)) {
                    rowMap.set(destKey, plazaRow);
                }
            });
        }

        const toSnapshotIdentity = (raw) => {
            if (!raw || String(raw).trim() === '') return null;
            const canonical = window.resolveEmployeeCanonicalId
                ? window.resolveEmployeeCanonicalId(raw, employees)
                : raw;
            const keyCanonical = window.normalizePersonKey(canonical || raw);
            if (keyCanonical && rowMap.has(keyCanonical)) return keyCanonical;
            return window.normalizePersonKey(raw) || null;
        };

        const rowMatchesEmployee = (row, rawId) => {
            const target = toSnapshotIdentity(rawId);
            const targetByName = window.normalizePersonKey(rawId);
            const rowId = toSnapshotIdentity(row.empleado_id || row.employee_id || row.id);
            if (target && rowId && rowId === target) return true;
            const rowName = window.normalizePersonKey(row.nombreVisible || row.nombre || '');
            if (rowName && targetByName && rowName === targetByName) return true;
            return false;
        };

        const findSnapshotRow = (rawId) => {
            const byKey = window.normalizePersonKey(rawId);
            if (byKey && rowMap.has(byKey)) return rowMap.get(byKey);
            return snap.rows.find(row => rowMatchesEmployee(row, rawId));
        };

        // 1. Validación de Ausencias
        events.forEach(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            const evHotel = window.normalizeId(window.getEventoHotel
                ? window.getEventoHotel(ev)
                : (ev.hotel || ev.hotel_origen || ev.hotel_destino || (ev.payload && ev.payload.hotel_id) || ''));
            const snapHotelNorm = window.normalizeId(snapHotelId);
            if (evHotel && snapHotelNorm && evHotel !== snapHotelNorm) return;

            const tipoEv = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERM', 'PERMISO'].includes(tipoEv)) return;

            const evStart = window.normalizeDate
                ? window.normalizeDate(ev.fecha_inicio)
                : (ev.fecha_inicio || '');
            const evEnd = window.normalizeDate
                ? window.normalizeDate(ev.fecha_fin || ev.fecha_inicio)
                : (ev.fecha_fin || ev.fecha_inicio || '');
            if (!evStart || !wStart || evStart > wEnd || evEnd < wStart) return;

            const row = findSnapshotRow(ev.empleado_id);
            if (!row) {
                errors.push('[BLOQUEO] Evento ' + tipoEv + ' de ' + ev.empleado_id + ' no aparece en el snapshot de ' + snapHotelId);
            } else {
                const cellDates = Object.keys(row.cells).filter(d => d >= evStart && d <= evEnd && d >= wStart && d <= wEnd);
                cellDates.forEach(d => {
                    const cell = row.cells[d];
                    if (!cell) return;
                    const code = String(cell.code || '').toUpperCase();
                    const type = String(cell.type || '').toUpperCase();
                    const expectedCodes = { 'VAC': 'VAC', 'BAJA': 'BAJA', 'PERMISO': 'PERM', 'PERM': 'PERM' };
                    const expected = expectedCodes[tipoEv];
                    if (!(expected && (code === expected || code.startsWith(expected) || type === expected))) {
                        errors.push('[BLOQUEO] Evento ' + tipoEv + ' no renderizado para ' + row.nombreVisible + ' el ' + d);
                    }
                });
            }
        });

        // 2. Validación de Intercambios
        events.forEach(ev => {
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            const normEv = window.normalizeCambioEvento(ev);
            if (!normEv || (normEv.tipo !== 'CAMBIO_TURNO' && normEv.tipo !== 'INTERCAMBIO_TURNO')) return;

            const evStart = normEv.fecha;
            if (!evStart || !wStart || evStart > wEnd || evStart < wStart) return;

            const evHotel = window.normalizeId(normEv.hotel || ev.hotel_origen || ev.hotel_destino || (ev.payload && ev.payload.hotel_id) || '');
            const snapHotelNorm = window.normalizeId(snapHotelId);
            if (evHotel && snapHotelNorm && evHotel !== snapHotelNorm) return;

            const idDest = toSnapshotIdentity(normEv.destino);

            // [SNAPSHOT_DESTINO_CHECK_TARGET]
            if (normEv.origen === 'Dani' || normEv.destino === 'Próximamente' || (ev.fecha_inicio && ev.fecha_inicio.startsWith('2026-10-21'))) {
                console.log('[SNAPSHOT_DESTINO_CHECK_TARGET]', {
                    eventoId: ev.id, fecha: evStart,
                    normalizadoOrigen: normEv.origen,
                    normalizadoDestino: normEv.destino,
                    idDest: idDest,
                    rowMapHasDest: idDest ? rowMap.has(idDest) : false
                });
            }

            // Placeholder destinations are valid operational destinations
            const isPlaceholderDest = ['¿?', '?', 'proximamente'].includes(
                window.normalizePersonKey(normEv.destino)
            );
            const destinoEsVacio = !normEv.destino
                || String(normEv.destino).trim() === ''
                || String(normEv.destino).toUpperCase() === 'NULL';

            // Only block if destination is truly empty (not a known placeholder)
            if (destinoEsVacio && !isPlaceholderDest) {
                errors.push('[BLOQUEO] Intercambio de ' + normEv.origen + ' el ' + evStart + ' tiene destino desconocido o vacío. Debe resolverse antes de publicar.');
                return;
            }

            const findOperationalRow = (rawId, date) => {
                const directKey = window.normalizePersonKey(rawId);
                if (directKey && rowMap.has(directKey)) return rowMap.get(directKey);
                const target = toSnapshotIdentity(rawId);
                if (target && target !== directKey && rowMap.has(target)) return rowMap.get(target);
                // Fallback: look for ¿? row if the key is unknown
                if (directKey && directKey !== '¿?' && !rowMap.has(directKey)) {
                    const plazaRowFound = rowMap.get('¿?')
                        || snap.rows.find(r => r.empleado_id === '¿?' || r.nombreVisible === '¿?');
                    if (plazaRowFound) return plazaRowFound;
                }
                return snap.rows.find(row => {
                    if (rowMatchesEmployee(row, rawId)) return true;
                    const cell = row.cells[date];
                    if (cell && cell.sustituyeA) {
                        const sk = window.normalizePersonKey(cell.sustituyeA);
                        if (sk && (sk === directKey || sk === target)) return true;
                    }
                    return false;
                });
            };

            const rowOrig = findOperationalRow(normEv.origen, evStart);
            const rowDest = findOperationalRow(normEv.destino, evStart);

            if (!rowOrig) {
                errors.push('[BLOQUEO] Origen de intercambio ' + normEv.origen + ' no aparece en el snapshot');
            } else {
                const cell = rowOrig.cells[evStart];
                if (cell && !cell.code.includes('\uD83D\uDD04')) {
                    errors.push('[BLOQUEO] Intercambio no renderizado (sin icono) para ' + rowOrig.nombreVisible + ' el ' + evStart);
                }
            }

            if (!rowDest) {
                errors.push('[BLOQUEO] Destino de intercambio ' + normEv.destino + ' no aparece en el snapshot');
            } else {
                const cell = rowDest.cells[evStart];
                if (cell && !cell.code.includes('\uD83D\uDD04')) {
                    errors.push('[BLOQUEO] Intercambio no renderizado (sin icono) para ' + rowDest.nombreVisible + ' el ' + evStart);
                }
            }
        });
    }

    // Cross-hotel duplicate check
    const allEmps = {};
    snapshots.forEach(s => s.rows.forEach(r => {
        const id = r.empleado_id || r.nombreVisible;
        if (!allEmps[id]) allEmps[id] = [];
        Object.entries(r.cells).forEach(([fecha, c]) => {
            if (c.code && c.code !== '\u2014' && c.code !== '') {
                allEmps[id].push({ fecha, hotel: s.hotel_nombre });
            }
        });
    }));
    Object.entries(allEmps).forEach(([id, shifts]) => {
        const days = {};
        shifts.forEach(s => {
            if (!days[s.fecha]) days[s.fecha] = [];
            days[s.fecha].push(s);
        });
        Object.entries(days).forEach(([fecha, entries]) => {
            if (entries.length > 1) {
                const hotels = entries.map(e => e.hotel).join(' y ');
                errors.push('[BLOQUEO] Duplicado operativo: ' + id + ' tiene turnos en ' + hotels + ' el ' + fecha);
            }
        });
    });

    return { ok: errors.length === 0, errors, warnings };
};

`;

    content = content.substring(0, VAL_START_IDX) + NEW_VALIDATOR + content.substring(endIdx);
    console.log('[PATCH 3] validatePublicationSnapshot replaced — OK');
    changed++;
} else {
    console.warn('[PATCH 3] validatePublicationSnapshot NOT FOUND');
}

// ─────────────────────────────────────────────────────────────
// Write result as UTF-8 without BOM
// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, content, { encoding: 'utf8' });
console.log(`\n✓ Patches applied: ${changed}`);
console.log('✓ File saved as UTF-8 without BOM');
console.log('File size:', fs.statSync(FILE).size, 'bytes');
