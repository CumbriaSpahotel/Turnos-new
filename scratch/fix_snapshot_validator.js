
const fs = require('fs');
const path = 'admin.js';
let content = fs.readFileSync(path, 'utf8');

const startMarker = "window.validatePublicationSnapshot = async (snapshots) => {";
// The end marker is now slightly different because of the restore
const idxStart = content.indexOf(startMarker);
const idxReturn = content.indexOf("return {", idxStart);
const idxEnd = content.indexOf("};", idxReturn) + 2;

if (idxStart === -1 || idxReturn === -1) {
    console.error("Markers not found. idxStart:", idxStart, "idxReturn:", idxReturn);
    process.exit(1);
}

const newFunc = `window.validatePublicationSnapshot = async (snapshots) => {
        const errors = [];
        const warnings = [];
        const validCodes = new Set(['M', 'T', 'N', 'D', 'VAC', 'BAJA', 'PERM', 'FORM', 'CT', '\\u2014', '']);
        
        for (const snap of snapshots) {
            const hName = snap.hotel_nombre;
            const wStart = snap.week_start || snap.semana_inicio || '';
            const wEnd   = snap.week_end   || snap.semana_fin   || '';
            
            // Forzar fetch de eventos para el rango del snapshot
            const events = await window.TurnosDB.fetchEventos(wStart, wEnd);
            
            const snapHotelId = snap.hotel_id || snap.hotel || snap.hotel_nombre || '';
            const employees = (window.empleadosGlobales && window.empleadosGlobales.length) ? window.empleadosGlobales : (window._employeeLineModels || []);
            
            const rowMap = new Map();
            (snap.rows || []).forEach(row => {
                const rawName = row.empleado || row.nombreVisible || row.nombre || row.employeeName || '';
                const keyName = window.normalizePersonKey(rawName);
                if (keyName && !rowMap.has(keyName)) rowMap.set(keyName, row);
                const rawId = row.empleado_id || row.employee_id || '';
                const keyId = window.normalizePersonKey(rawId);
                if (keyId && keyId !== keyName && !rowMap.has(keyId)) rowMap.set(keyId, row);
            });

            // Enriquecer rowMap con alias para placeholders operativos
            const plazaRow = rowMap.get('\u00bf?') || rowMap.get('') || null;
            if (plazaRow) {
                (events || []).forEach(ev => {
                    if (window.normalizeEstado(ev.estado) === 'anulado') return;
                    const destRaw = ev.empleado_destino_id || ev.destino || ev.companero || '';
                    if (!destRaw) return;
                    const destKey = window.normalizePersonKey(destRaw);
                    if (destKey && destKey !== '\u00bf?' && destKey !== '' && !rowMap.has(destKey)) {
                        rowMap.set(destKey, plazaRow);
                    }
                });
            }

            const toSnapshotIdentity = (raw) => {
                if (!raw || String(raw).trim() === '') return null;
                const canonical = window.resolveEmployeeCanonicalId ? window.resolveEmployeeCanonicalId(raw, employees) : raw;
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

            // 1. Validaci\u00f3n de Ausencias
            events.forEach(ev => {
                if (window.normalizeEstado(ev.estado) === 'anulado') return;
                const evHotel = window.normalizeId(window.getEventoHotel ? window.getEventoHotel(ev) : (ev.hotel || ev.hotel_origen || ev.hotel_destino || ev.payload?.hotel_id || ''));
                const snapHotelNorm = window.normalizeId(snapHotelId);
                if (evHotel && snapHotelNorm && evHotel !== snapHotelNorm) return;
                
                const tipoEv = window.normalizeTipo(ev.tipo);
                if (!['VAC', 'BAJA', 'PERM', 'PERMISO'].includes(tipoEv)) return;
                
                const evStart = window.normalizeDate ? window.normalizeDate(ev.fecha_inicio) : (ev.fecha_inicio || '');
                const evEnd   = window.normalizeDate ? window.normalizeDate(ev.fecha_fin || ev.fecha_inicio) : (ev.fecha_fin || ev.fecha_inicio || '');
                if (!evStart || !wStart || evStart > wEnd || evEnd < wStart) return;

                const row = findSnapshotRow(ev.empleado_id);
                if (!row) {
                    errors.push(\`[BLOQUEO] Evento \${tipoEv} de \${ev.empleado_id} no aparece en el snapshot de \${snapHotelId}\`);
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
                            errors.push(\`[BLOQUEO] Evento \${tipoEv} no renderizado para \${row.nombreVisible} el \${d}\`);
                        }
                    });
                }
            });

            // 2. Validaci\u00f3n de Intercambios
            events.forEach(ev => {
                if (window.normalizeEstado(ev.estado) === 'anulado') return;
                const normEv = window.normalizeCambioEvento(ev);
                if (!normEv || (normEv.tipo !== 'CAMBIO_TURNO' && normEv.tipo !== 'INTERCAMBIO_TURNO')) return;
                
                const evStart = normEv.fecha;
                if (!evStart || !wStart || evStart > wEnd || evStart < wStart) return;

                const evHotel = window.normalizeId(normEv.hotel || ev.hotel_origen || ev.hotel_destino || ev.payload?.hotel_id || '');
                const snapHotelNorm = window.normalizeId(snapHotelId);
                if (evHotel && snapHotelNorm && evHotel !== snapHotelNorm) return;

                const idOrig = toSnapshotIdentity(normEv.origen);
                const idDest = toSnapshotIdentity(normEv.destino);

                // [SNAPSHOT_DESTINO_CHECK_TARGET]
                if (normEv.origen === 'Dani' || normEv.destino === 'Pr\u00f3ximamente' || (ev.fecha_inicio && ev.fecha_inicio.startsWith('2026-10-21'))) {
                    console.log('[SNAPSHOT_DESTINO_CHECK_TARGET]', {
                        eventoId: ev.id,
                        fecha: evStart,
                        origenRaw: ev.empleado_id,
                        destinoRaw: ev.empleado_destino_id || ev.destino || ev.companero || '',
                        payloadDestino: ev.payload?.destino || ev.payload?.empleado_destino_id,
                        normalizadoOrigen: normEv.origen,
                        normalizadoDestino: normEv.destino,
                        idDest: idDest,
                        rowMapHasDest: idDest ? rowMap.has(idDest) : false
                    });
                }

                const isPlaceholderDest = ['\u00bf?', '?', 'proximamente'].includes(window.normalizePersonKey(normEv.destino));
                const destinoEsVacio = !normEv.destino || String(normEv.destino).trim() === '' || String(normEv.destino).toUpperCase() === 'NULL';
                const DESTINO_INVALIDO = new Set(['\u00bf?', '?', 'desconocido', 'null', 'undefined', '']);
                const destinoEsInvalido = (!idDest || DESTINO_INVALIDO.has(idDest)) && !isPlaceholderDest;
                
                if (destinoEsVacio || destinoEsInvalido) {
                    errors.push(\`[BLOQUEO] Intercambio de \${normEv.origen} el \${evStart} tiene destino desconocido o vac\u00edo. Debe resolverse antes de publicar.\`);
                    return;
                }

                const findOperationalOccupantRow = (rawId, date) => {
                    const directKey = window.normalizePersonKey(rawId);
                    if (directKey && rowMap.has(directKey)) return rowMap.get(directKey);
                    const target = toSnapshotIdentity(rawId);
                    if (target && target !== directKey && rowMap.has(target)) return rowMap.get(target);
                    if (directKey && directKey !== '\u00bf?' && !rowMap.has(directKey)) {
                        const plazaRowFound = rowMap.get('\u00bf?') || snap.rows.find(r => r.empleado_id === '\u00bf?' || r.nombreVisible === '\u00bf?');
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

                const rowOrig = findOperationalOccupantRow(normEv.origen, evStart);
                const rowDest = findOperationalOccupantRow(normEv.destino, evStart);

                if (!rowOrig) {
                    errors.push(\`[BLOQUEO] Origen de intercambio \${normEv.origen} no aparece en el snapshot\`);
                } else {
                    const cell = rowOrig.cells[evStart];
                    if (cell && !cell.code.includes('\u{1F504}')) {
                        errors.push(\`[BLOQUEO] Intercambio no renderizado (sin icono) para \${rowOrig.nombreVisible} el \${evStart}\`);
                    }
                }

                if (!rowDest) {
                    errors.push(\`[BLOQUEO] Destino de intercambio \${normEv.destino} no aparece en el snapshot\`);
                } else {
                    const cell = rowDest.cells[evStart];
                    if (cell && !cell.code.includes('\u{1F504}')) {
                        errors.push(\`[BLOQUEO] Intercambio no renderizado (sin icono) para \${rowDest.nombreVisible} el \${evStart}\`);
                    }
                }
            });
        }

        const allEmps = {};
        snapshots.forEach(s => s.rows.forEach(r => {
            const id = r.empleado_id || r.nombreVisible;
            if (!allEmps[id]) allEmps[id] = [];
            Object.entries(r.cells).forEach(([fecha, c]) => {
                if (c.code && c.code !== '\\u2014' && c.code !== '') allEmps[id].push({ fecha, hotel: s.hotel_nombre });
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
                    errors.push(\`[BLOQUEO] Duplicado operativo: \${id} tiene turnos en \${hotels} el \${fecha}\`);
                }
            });
        });

        return { ok: errors.length === 0, errors, warnings };
    };`;

content = content.substring(0, idxStart) + newFunc + content.substring(idxEnd);
fs.writeFileSync(path, content, 'utf8');
console.log("Success");
