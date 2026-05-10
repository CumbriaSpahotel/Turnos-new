$path = "admin.js"
$content = Get-Content $path -Raw
$badBlock = 'errors.push\(`\[BLOQUEO\] Evento \$\{tipoEv\} no renderizado para \$\{row.nombreVisible\} el \$\{d\} -snapshot tiene code="\$\{code\}" type="\$\{type\}"`\);\s+ev.sustituto_id \|\|\s+};'
$goodBlock = 'errors.push(`[BLOQUEO] Evento ${tipoEv} no renderizado para ${row.nombreVisible} el ${d} -snapshot tiene code="${code}" type="${type}"`);
                        }
                    });
                }
            });

            // [O] Validación de Consistencia de Cambios de Turno / Intercambios
            events.forEach(ev => {
                if (window.normalizeEstado(ev.estado) === "anulado") return;
                const tipoEv = window.normalizeTipo(ev.tipo);
                if (tipoEv !== "CAMBIO_TURNO" && tipoEv !== "INTERCAMBIO_TURNO") return;

                const evStart = window.normalizeDate ? window.normalizeDate(ev.fecha_inicio) : (ev.fecha_inicio || "");
                if (!evStart || !wStart || evStart > wEnd || evStart < wStart) return;

                const idOrig = window.normalizeId(ev.empleado_id);
                const idDest = window.normalizeId(
                    ev.empleado_destino_id ||
                    ev.sustituto_id ||
                    ev.sustituto ||
                    ev.payload?.empleado_destino_id ||
                    ev.payload?.sustituto_id ||
                    ev.payload?.sustituto ||
                    ev.payload?.sustituto_nombre
                );

                const matchesSnapshotRow = (row, id) => {
                    if (!row || !id) return false;
                    const keys = [row.empleado_id, row.nombre, row.nombreVisible];
                    return keys.some(k => {
                        const nk = window.normalizeId(k);
                        return nk === id || nk.includes(id) || id.includes(nk);
                    });
                };

                // RESOLUCIÓN OPERATIVA (V140)
                const resolvedOrig = window.getOperationalOccupant ? window.getOperationalOccupant(idOrig, evStart, events, snapHotelId) : idOrig;
                const resolvedDest = idDest ? (window.getOperationalOccupant ? window.getOperationalOccupant(idDest, evStart, events, snapHotelId) : idDest) : null;

                const rowOrig = snap.rows.find(r => matchesSnapshotRow(r, resolvedOrig));
                const rowDest = resolvedDest ? snap.rows.find(r => matchesSnapshotRow(r, resolvedDest)) : null;

                const checkCell = (row, id, role) => {
                    if (!row) return;
                    const cell = row.cells[evStart];
                    if (!cell) return;
                    const isChanged = !!cell.changed || !!cell.intercambio || (cell.origen && cell.origen.includes("CAMBIO"));
                    const hasIcon = Array.isArray(cell.icons) && cell.icons.includes("📌");
                    if (!isChanged && !hasIcon) {
                        errors.push(`[BLOQUEO] El ${role} del cambio (${id}) no muestra el icono 📌 el ${evStart} en ${snapHotelId}`);
                    }
                };'

# Using a simpler string replacement if regex is too complex
$oldStr = 'errors.push(`[BLOQUEO] Evento ${tipoEv} no renderizado para ${row.nombreVisible} el ${d} -snapshot tiene code="${code}" type="${type}"`);' + "`r`n" + '                    ev.sustituto_id ||' + "`r`n" + '                };'
$newStr = 'errors.push(`[BLOQUEO] Evento ${tipoEv} no renderizado para ${row.nombreVisible} el ${d} -snapshot tiene code="${code}" type="${type}"`);' + "`r`n" + '                        }' + "`r`n" + '                    });' + "`r`n" + '                }' + "`r`n" + '            });' + "`r`n`n" + '            // [O] Validación de Consistencia de Cambios de Turno / Intercambios' + "`r`n" + '            events.forEach(ev => {' + "`r`n" + '                if (window.normalizeEstado(ev.estado) === "anulado") return;' + "`r`n" + '                const tipoEv = window.normalizeTipo(ev.tipo);' + "`r`n" + '                if (tipoEv !== "CAMBIO_TURNO" && tipoEv !== "INTERCAMBIO_TURNO") return;' + "`r`n`n" + '                const evStart = window.normalizeDate ? window.normalizeDate(ev.fecha_inicio) : (ev.fecha_inicio || "");' + "`r`n" + '                if (!evStart || !wStart || evStart > wEnd || evStart < wStart) return;' + "`r`n`n" + '                const idOrig = window.normalizeId(ev.empleado_id);' + "`r`n" + '                const idDest = window.normalizeId(' + "`r`n" + '                    ev.empleado_destino_id ||' + "`r`n" + '                    ev.sustituto_id ||' + "`r`n" + '                    ev.sustituto ||' + "`r`n" + '                    ev.payload?.empleado_destino_id ||' + "`r`n" + '                    ev.payload?.sustituto_id ||' + "`r`n" + '                    ev.payload?.sustituto ||' + "`r`n" + '                    ev.payload?.sustituto_nombre' + "`r`n" + '                );' + "`r`n`n" + '                const matchesSnapshotRow = (row, id) => {' + "`r`n" + '                    if (!row || !id) return false;' + "`r`n" + '                    const keys = [row.empleado_id, row.nombre, row.nombreVisible];' + "`r`n" + '                    return keys.some(k => {' + "`r`n" + '                        const nk = window.normalizeId(k);' + "`r`n" + '                        return nk === id || nk.includes(id) || id.includes(nk);' + "`r`n" + '                    });' + "`r`n" + '                };' + "`r`n`n" + '                // RESOLUCIÓN OPERATIVA (V140)' + "`r`n" + '                const resolvedOrig = window.getOperationalOccupant ? window.getOperationalOccupant(idOrig, evStart, events, snapHotelId) : idOrig;' + "`r`n" + '                const resolvedDest = idDest ? (window.getOperationalOccupant ? window.getOperationalOccupant(idDest, evStart, events, snapHotelId) : idDest) : null;' + "`r`n`n" + '                const rowOrig = snap.rows.find(r => matchesSnapshotRow(r, resolvedOrig));' + "`r`n" + '                const rowDest = resolvedDest ? snap.rows.find(r => matchesSnapshotRow(r, resolvedDest)) : null;' + "`r`n`n" + '                const checkCell = (row, id, role) => {' + "`r`n" + '                    if (!row) return;' + "`r`n" + '                    const cell = row.cells[evStart];' + "`r`n" + '                    if (!cell) return;' + "`r`n" + '                    const isChanged = !!cell.changed || !!cell.intercambio || (cell.origen && cell.origen.includes("CAMBIO"));' + "`r`n" + '                    const hasIcon = Array.isArray(cell.icons) && cell.icons.includes("📌");' + "`r`n" + '                    if (!isChanged && !hasIcon) {' + "`r`n" + '                        errors.push(`[BLOQUEO] El ${role} del cambio (${id}) no muestra el icono 📌 el ${evStart} en ${snapHotelId}`);' + "`r`n" + '                    }' + "`r`n" + '                };'

$content = $content.Replace($oldStr, $newStr)
$content | Set-Content $path -NoNewline
