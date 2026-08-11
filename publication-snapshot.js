(function() {
    const HOTEL_IDS = new Map([
      ['cumbria spa&hotel', 'cumbriaspahotel'],
      ['sercotel guadiana', 'sercotelguadiana']
    ]);

    function getCanonicalHotelId(hotelName) {
        if (!hotelName) return null;
        const norm = String(hotelName).trim().toLowerCase();
        if (HOTEL_IDS.has(norm)) {
            return HOTEL_IDS.get(norm);
        }
        console.error('[HOTEL_ID_RESOLUTION_FAILED] Unknown hotel name:', hotelName);
        return null;
    }

    function normalizeLocalDateKey(value) {
        if (!value) return null;
        if (value instanceof Date) {
            if (isNaN(value.getTime())) return null;
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        const s = String(value).trim();
        // Check YYYY-MM-DD
        const matchYMD = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchYMD) {
            const y = parseInt(matchYMD[1], 10);
            const m = parseInt(matchYMD[2], 10);
            const d = parseInt(matchYMD[3], 10);
            if (isValidCivilDate(y, m, d)) return `${matchYMD[1]}-${matchYMD[2]}-${matchYMD[3]}`;
        }
        // Check DD/MM/YYYY
        const matchDMY = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (matchDMY) {
            const d = parseInt(matchDMY[1], 10);
            const m = parseInt(matchDMY[2], 10);
            const y = parseInt(matchDMY[3], 10);
            if (isValidCivilDate(y, m, d)) return `${matchDMY[3]}-${matchDMY[2]}-${matchDMY[1]}`;
        }
        return null;
    }

    function isValidCivilDate(year, month, day) {
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        const daysInMonth = new Date(year, month, 0).getDate();
        return day <= daysInMonth;
    }

    function buildCanonicalRowKey(row, context) {
        const puestoId = String(row.rol || row.puesto || 'no_puesto').toLowerCase().trim();
        const empId = context.resolveEmployeeId ? context.resolveEmployeeId(row.employeeId || row.empleado_id || row.nombre || '') : null;
        const rowType = String(row.rowType || 'operativo').toLowerCase().trim();
        return `${puestoId}|${empId || 'null'}|${rowType}`;
    }

    function canonicalRowsEqual(rowA, rowB) {
        if (rowA.employeeId !== rowB.employeeId) return false;
        if (rowA.puestoId !== rowB.puestoId) return false;
        if (rowA.rowType !== rowB.rowType) return false;
        // Compare days
        const daysA = rowA.days || {};
        const daysB = rowB.days || {};
        const allDates = new Set([...Object.keys(daysA), ...Object.keys(daysB)]);
        for (const date of allDates) {
            const cellA = daysA[date] || { code: null, relationEmployeeId: null };
            const cellB = daysB[date] || { code: null, relationEmployeeId: null };
            if (cellA.code !== cellB.code || cellA.relationEmployeeId !== cellB.relationEmployeeId) {
                return false;
            }
        }
        return true;
    }

    function adaptLegacyPublishedSnapshot(snapshot) {
        if (!snapshot) return null;
        const adapted = {
            hotel: snapshot.hotel || snapshot.hotel_id || snapshot.hotel_nombre || '',
            semana_inicio: snapshot.semana_inicio || snapshot.week_start || '',
            semana_fin: snapshot.semana_fin || snapshot.week_end || '',
            rows: []
        };
        const rawRows = snapshot.rows || snapshot.empleados || [];
        adapted.rows = rawRows.map(row => {
            const rawDays = row.dias || row.cells || row.days || {};
            const days = {};
            Object.keys(rawDays).forEach(d => {
                const dayObj = rawDays[d] || {};
                let code = '';
                if (typeof dayObj === 'object') {
                    code = dayObj.code || dayObj.turno || '';
                } else {
                    code = String(dayObj);
                }
                const relation = dayObj.titular_cubierto || dayObj.coversEmployeeId || dayObj.sustituyeA ||
                                 dayObj.sustituto || dayObj.coveredByEmployeeId || dayObj.sustituidoPor ||
                                 dayObj.relationEmployeeId || null;
                days[d] = {
                    code: code,
                    relationEmployeeId: relation,
                    origen: dayObj.origen || dayObj.type || 'base'
                };
            });
            return {
                employeeId: row.empleado_id || row.employee_id || row.employeeId || row.nombre || '',
                nombre: row.nombre || '',
                nombreVisible: row.nombreVisible || row.nombre || '',
                rowType: row.rowType || 'operativo',
                puestoOrden: row.puestoOrden || row.orden || 999,
                rol: row.rol || row.puesto || '',
                puesto: row.puesto || row.rol || '',
                days: days
            };
        });
        return adapted;
    }

    function normalizePublishedSchedule(snapshot, context = {}) {
        if (!snapshot) return { schedule: null, warnings: ['No snapshot provided'], complete: false };

        const adapted = adaptLegacyPublishedSnapshot(snapshot);
        if (!adapted) return { schedule: null, warnings: ['Adaptation failed'], complete: false };

        const hotelId = getCanonicalHotelId(adapted.hotel);
        const weekStart = normalizeLocalDateKey(adapted.semana_inicio);

        if (!hotelId || !weekStart) {
            return {
                schedule: null,
                warnings: [`Invalid hotelId (${hotelId}) or weekStart (${weekStart})`],
                complete: false
            };
        }

        const resolveEmployeeId = context.resolveEmployeeId || ((id) => id);
        const normalizedRows = [];
        const rowsMap = new Map();
        const warnings = [];
        let complete = true;

        const dateKeys = [];
        for (let i = 0; i < 7; i++) {
            const dateObj = new Date(weekStart + 'T12:00:00');
            dateObj.setDate(dateObj.getDate() + i);
            dateKeys.push(normalizeLocalDateKey(dateObj));
        }

        const rawRows = adapted.rows || [];
        for (const row of rawRows) {
            const empId = resolveEmployeeId(row.employeeId || '');
            if (!empId) {
                warnings.push(`Could not resolve employee identity for: ${row.employeeId}`);
                complete = false;
                continue;
            }

            const puestoId = String(row.rol || row.puesto || 'no_puesto').toLowerCase().trim();
            const rowType = String(row.rowType || 'operativo').toLowerCase().trim();

            const days = {};
            const rawDays = row.days || {};

            dateKeys.forEach(date => {
                const dayObj = rawDays[date] || {};
                let codeVal = String(dayObj.code || '').trim();
                if (codeVal === '—' || codeVal === 'undefined' || codeVal === '') {
                    codeVal = null;
                } else {
                    const upCode = codeVal.toUpperCase();
                    if (['M', 'T', 'N', 'D', 'VAC', 'BAJA', 'PERM', 'PERMISO', 'FORM', 'FORMACION'].includes(upCode)) {
                        codeVal = upCode;
                    }
                }

                let relationId = null;
                const rawRelation = dayObj.relationEmployeeId || dayObj.titular_cubierto || dayObj.sustituto || null;
                if (rawRelation) {
                    relationId = resolveEmployeeId(rawRelation) || null;
                    if (!relationId) {
                        warnings.push(`Could not resolve relation identity: ${rawRelation}`);
                        complete = false;
                    }
                }

                days[date] = {
                    code: codeVal,
                    relationEmployeeId: relationId,
                    horario: cellVal?.horario || cellVal?.payload?.horario || null,
                    label: cellVal?.label || null,
                    title: cellVal?.title || null
                };
            });

            const normalizedRow = {
                employeeId: empId,
                puestoId: puestoId,
                rowType: rowType,
                days: days
            };

            const rowKey = buildCanonicalRowKey(row, { resolveEmployeeId });

            if (rowsMap.has(rowKey)) {
                const existing = rowsMap.get(rowKey);
                if (!canonicalRowsEqual(existing, normalizedRow)) {
                    throw new Error(`Conflicting canonical row key: ${rowKey}`);
                }
                continue;
            }

            rowsMap.set(rowKey, normalizedRow);
            normalizedRows.push(normalizedRow);
        }

        normalizedRows.sort((a, b) => {
            const typeA = a.rowType === 'operativo' ? 0 : (a.rowType === 'refuerzo' ? 1 : 2);
            const typeB = b.rowType === 'operativo' ? 0 : (b.rowType === 'refuerzo' ? 1 : 2);
            if (typeA !== typeB) return typeA - typeB;
            
            const cmpPuesto = a.puestoId.localeCompare(b.puestoId);
            if (cmpPuesto !== 0) return cmpPuesto;

            return a.employeeId.localeCompare(b.employeeId);
        });

        return {
            schedule: {
                hotelId: hotelId,
                weekStart: weekStart,
                rows: normalizedRows
            },
            warnings: warnings,
            complete: complete
        };
    }

    function diffPublishedSchedules(current, published, context = {}) {
        const diffs = [];
        const normCur = normalizePublishedSchedule(current, context);
        const normPub = normalizePublishedSchedule(published, context);

        if (!normCur.complete || !normPub.complete) {
            console.warn('[DIFF] Incomplete snapshots. Current complete:', normCur.complete, 'Published complete:', normPub.complete);
        }

        if (!normCur.schedule || !normPub.schedule) return diffs;

        const resolveEmployeeId = context.resolveEmployeeId || ((id) => id);
        const currentRowsMap = new Map();
        normCur.schedule.rows.forEach(r => {
            currentRowsMap.set(buildCanonicalRowKey(r, { resolveEmployeeId }), r);
        });
        const publishedRowsMap = new Map();
        normPub.schedule.rows.forEach(r => {
            publishedRowsMap.set(buildCanonicalRowKey(r, { resolveEmployeeId }), r);
        });

        const allRowKeys = new Set([...currentRowsMap.keys(), ...publishedRowsMap.keys()]);

        for (const rKey of allRowKeys) {
            const rCur = currentRowsMap.get(rKey);
            const rPub = publishedRowsMap.get(rKey);

            if (!rPub) {
                diffs.push({
                    scope: 'row',
                    changeType: 'added',
                    rowKey: rKey,
                    date: null,
                    before: null,
                    after: rCur
                });
                continue;
            }

            if (!rCur) {
                diffs.push({
                    scope: 'row',
                    changeType: 'removed',
                    rowKey: rKey,
                    date: null,
                    before: rPub,
                    after: null
                });
                continue;
            }

            const dates = Object.keys(rCur.days).sort();
            dates.forEach(date => {
                const cellCur = rCur.days[date];
                const cellPub = rPub.days[date];

                if (
                    cellCur.code !== cellPub.code || 
                    cellCur.relationEmployeeId !== cellPub.relationEmployeeId ||
                    cellCur.horario !== cellPub.horario ||
                    cellCur.label !== cellPub.label ||
                    cellCur.title !== cellPub.title
                ) {
                    diffs.push({
                        scope: 'cell',
                        changeType: 'modified',
                        rowKey: rKey,
                        date: date,
                        before: cellPub,
                        after: cellCur
                    });
                }
            });
        }

        return diffs;
    }

    const PublicationSnapshot = {
        getCanonicalHotelId,
        normalizeLocalDateKey,
        buildCanonicalRowKey,
        normalizePublishedSchedule,
        diffPublishedSchedules,
        adaptLegacyPublishedSnapshot,
        HOTEL_IDS
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PublicationSnapshot;
    } else {
        window.PublicationSnapshot = PublicationSnapshot;
    }
})();
