// ==========================================
// 1. NÚCLEO Y CONFIGURACIÓN GLOBAL
// ==========================================
window.parsedData = null;
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => document.querySelectorAll(s);

window.cleanLogText = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

window.addLog = (msg, type = 'info') => {
    const bodies = [$('#logBody'), $('#homeLogBody')];
    const time = new Date().toLocaleTimeString();
    
    bodies.forEach(body => {
        if (!body) return;
        const line = document.createElement('div');
        line.className = `log-line log-${type}`;
        line.style.borderLeft = `3px solid ${type === 'ok' ? '#10e898' : (type === 'warn' ? '#ff9800' : (type === 'error' ? '#ff5f57' : 'var(--accent)'))}`;
        line.style.padding = '5px 10px';
        line.style.fontSize = '0.75rem';
        line.style.marginBottom = '2px';
        line.textContent = `> ${window.cleanLogText(msg)} [${time}]`;
        
        if (body.id === 'homeLogBody') {
            body.prepend(line);
        } else {
            body.appendChild(line);
            body.scrollTop = body.scrollHeight;
        }
    });
};

window.switchSection = (id) => {
    const sections = $$('.section');
    const navItems = $$('.nav-item');
    sections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetSec = $(`#section-${id}`);
    if (targetSec) targetSec.classList.add('active');
    const targetNav = $(`#nav-${id}`);
    if (targetNav) targetNav.classList.add('active');

    if (id === 'preview') window.renderPreview();
    if (id === 'excel') window.renderExcelView();
    
    // ── NAVEGACIÓN Y TABS ────────────────────────────────────────────────────────
    window.switchTab = (tabId) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`)?.classList.add('active');
        document.getElementById('empleadosView').style.display = tabId === 'empleados' ? 'block' : 'none';
        document.getElementById('previewView').style.display = tabId === 'preview' ? 'block' : 'none';
        document.getElementById('rawView').style.display = tabId === 'raw' ? 'block' : 'none';
        if (tabId === 'raw') window.renderExcelView();
    };
};

window.ADMIN_EXCEL_STORAGE_KEY = 'turnosweb_admin_excel_base_v1';

window.cloneExcelRows = (value) => JSON.parse(JSON.stringify(value || {}));

window.loadAdminExcelSourceRows = async ({ forceBase = false } = {}) => {
    if (!window._adminExcelBaseOriginalRows || forceBase) {
        window._adminExcelBaseOriginalRows = window.cloneExcelRows(await window.ExcelLoader.loadExcelSourceRows());
    }

    if (forceBase) {
        return window.cloneExcelRows(window._adminExcelBaseOriginalRows);
    }

    if (window._adminExcelEditableRows) return window._adminExcelEditableRows;

    try {
        const stored = localStorage.getItem(window.ADMIN_EXCEL_STORAGE_KEY);
        if (stored) {
            window._adminExcelEditableRows = JSON.parse(stored);
            return window._adminExcelEditableRows;
        }
    } catch (error) {
        console.warn('No se pudieron leer los cambios locales del Excel base:', error);
    }

    window._adminExcelEditableRows = window.cloneExcelRows(window._adminExcelBaseOriginalRows);
    return window._adminExcelEditableRows;
};

window.persistAdminExcelSourceRows = () => {
    const rows = window._adminExcelEditableRows || {};
    localStorage.setItem(window.ADMIN_EXCEL_STORAGE_KEY, JSON.stringify(rows));
    window.addLog('Base Excel guardada en local', 'ok');
};

window.resetAdminExcelSourceRows = async () => {
    localStorage.removeItem(window.ADMIN_EXCEL_STORAGE_KEY);
    window._adminExcelEditableRows = await window.loadAdminExcelSourceRows({ forceBase: true });
    window.renderExcelView();
    window.renderPreview();
    if (window.populateEmployees) window.populateEmployees();
};

window.findEditableExcelRow = (hotel, weekStart, rowIndex) => {
    const rows = window._adminExcelEditableRows?.[hotel] || [];
    return rows.find(row => String(row.weekStart) === String(weekStart) && Number(row.rowIndex) === Number(rowIndex)) || null;
};

window.updateExcelBaseName = (hotel, weekStart, rowIndex, value) => {
    const row = window.findEditableExcelRow(hotel, weekStart, rowIndex);
    if (!row) return;
    row.displayName = String(value || '').trim();
    row.empleadoId = row.displayName;
};

window.updateExcelBaseShift = (hotel, weekStart, rowIndex, offset, value) => {
    const row = window.findEditableExcelRow(hotel, weekStart, rowIndex);
    if (!row) return;
    row.values[offset] = window.normalizePreviewTurno(value);
};

window.renderExcelView = async () => {
    const container = $('#excel-grid-container');
    if (!container) return;

    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-dim);">Cargando Excel base...</div>';

    try {
        const baseOriginal = await window.loadAdminExcelSourceRows({ forceBase: true });
        const baseEditado = await window.loadAdminExcelSourceRows();
        const excelRows = baseEditado;
        const hotelSelect = $('#excelHotel');
        const monthInput = $('#excelMonth');
        const selectedHotel = hotelSelect?.value || 'all';

        if (monthInput && !monthInput.value) monthInput.value = window.isoDate(new Date()).slice(0, 7);
        const selectedMonth = monthInput?.value || window.isoDate(new Date()).slice(0, 7);
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthStart = `${selectedMonth}-01`;
        const monthEnd = window.isoDate(new Date(year, month, 0));

        const hotels = Object.keys(excelRows || {});
        if (hotelSelect && hotelSelect.options.length <= 1) {
            hotelSelect.innerHTML = `<option value="all">Filtro por Hotel: Ver Todos</option>${hotels.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('')}`;
            hotelSelect.value = selectedHotel;
        }

        const hotelsToRender = selectedHotel === 'all' ? hotels : [selectedHotel];
        const shiftOptions = ['', 'M', 'T', 'N', 'D'];

        container.innerHTML = `
            <div style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; gap:12px; border-bottom:1px solid var(--border); background:var(--bg3);">
                <div>
                    <div style="font-weight:800; color:var(--text);">Modo Excel</div>
                    <div style="font-size:0.75rem; color:var(--text-dim);">Base original separada de base editada (${Object.keys(baseOriginal || {}).length} hoteles). Los cambios se guardan en local y no tocan backend.</div>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn active" onclick="window.persistAdminExcelSourceRows(); window.renderPreview(); if (window.populateEmployees) window.populateEmployees();" style="background:var(--accent); color:white;">Guardar base</button>
                    <button class="btn" onclick="window.resetAdminExcelSourceRows()" style="background:var(--bg3); color:var(--text); border:1px solid var(--border);">Restaurar base original</button>
                </div>
            </div>
        `;

        const sections = hotelsToRender.map(hotel => {
            const rows = (excelRows[hotel] || [])
                .filter(row => {
                    const rowEnd = window.addIsoDays(row.weekStart, 6);
                    return row.weekStart <= monthEnd && rowEnd >= monthStart;
                })
                .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.rowIndex - b.rowIndex);

            if (!rows.length) {
                return `
                    <div style="padding:24px; border-bottom:1px solid #eef2f7;">
                        <div style="font-weight:800; color:#0f172a; margin-bottom:8px;">${escapeHtml(hotel)}</div>
                        <div style="color:#64748b; font-size:0.85rem;">No hay filas del Excel base para este mes.</div>
                    </div>
                `;
            }

            return `
                <div style="padding:0 0 24px 0; border-bottom:1px solid #eef2f7;">
                    <div style="padding:18px 20px; font-weight:800; color:#0f172a; background:#f8fafc; border-bottom:1px solid #eef2f7;">${escapeHtml(hotel)}</div>
                    <div style="overflow:auto;">
                        <table style="width:100%; border-collapse:collapse; min-width:980px; background:white;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:10px 12px; border-bottom:1px solid #eef2f7; text-align:left;">Semana</th>
                                    <th style="padding:10px 12px; border-bottom:1px solid #eef2f7; text-align:left;">Empleado</th>
                                    ${['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map(day => `<th style="padding:10px 8px; border-bottom:1px solid #eef2f7; text-align:center;">${day}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(row => `
                                    <tr>
                                        <td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">${escapeHtml(window.fmtDateLegacy(row.weekStart))}</td>
                                        <td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; min-width:220px;">
                                            <input type="text" value="${escapeHtml(row.displayName || row.empleadoId || '')}" onchange="window.updateExcelBaseName(${JSON.stringify(hotel)}, ${JSON.stringify(row.weekStart)}, ${row.rowIndex}, this.value)" style="width:100%; padding:8px 10px; border:1px solid #dbe4ee; border-radius:10px; background:white;">
                                        </td>
                                        ${[0, 1, 2, 3, 4, 5, 6].map(offset => `
                                            <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">
                                                <select onchange="window.updateExcelBaseShift(${JSON.stringify(hotel)}, ${JSON.stringify(row.weekStart)}, ${row.rowIndex}, ${offset}, this.value)" style="width:72px; padding:8px; border:1px solid #dbe4ee; border-radius:10px; background:white; text-align:center;">
                                                    ${shiftOptions.map(option => `<option value="${option}" ${String(row.values?.[offset] || '') === option ? 'selected' : ''}>${option || '-'}</option>`).join('')}
                                                </select>
                                            </td>
                                        `).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML += sections || '<div style="padding: 2rem; text-align: center; color: var(--text-dim);">No hay datos del Excel base para el filtro actual.</div>';
    } catch (error) {
        container.innerHTML = `<div style="padding:2rem; color:red;">Error cargando Excel base: ${escapeHtml(error.message)}</div>`;
    }
};

window.toggleTheme = () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('turnosweb_theme', isLight ? 'light' : 'dark');
};

window.isoDate = (date) => {
    if (!date) return '';
    let d;
    if (typeof date === 'number') {
        d = new Date((date - 25569) * 86400 * 1000);
    } else if (typeof date === 'string' && date.includes('-')) {
        d = new Date(date + 'T12:00:00');
    } else {
        d = new Date(date);
    }
    if (isNaN(d.getTime())) return date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

window.getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const result = new Date(d.setDate(diff));
    return result;
};

// ==========================================
// 2. EXCEL SOURCE LOADER — delegado a excel-loader.js
// ==========================================
// La función loadExcelSourceRows() la provee window.ExcelLoader (excel-loader.js).
// window._sharedExcelSourceRows es la caché compartida con index y mobile.

// ==========================================
// 3. RENDER PREVIEW (WEEKLY / MONTHLY)
// ==========================================
window._previewMode = 'weekly';
window.switchPreviewMode = (mode) => {
    window._previewMode = mode;
    const btnW = $('#btnViewWeekly'), btnM = $('#btnViewMonthly');
    const dateC = $('#prevDateContainer'), monthC = $('#prevMonthContainer');
    if (btnW) btnW.classList.toggle('active', mode === 'weekly');
    if (btnM) btnM.classList.toggle('active', mode === 'monthly');
    if (dateC) dateC.style.display = mode === 'weekly' ? 'flex' : 'none';
    if (monthC) monthC.style.display = mode === 'monthly' ? 'flex' : 'none';
    window.renderPreview();
};

window.addIsoDays = (iso, days) => {
    if (!iso) return '';
    const date = new Date(`${iso}T12:00:00`);
    date.setDate(date.getDate() + days);
    return window.isoDate(date);
};

window.getFechasSemana = (fechaSemanaStr) => {
    if (!fechaSemanaStr) return [];

    let lunes = null;
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(fechaSemanaStr)) {
        const [d, m, y] = fechaSemanaStr.split('/');
        const year = 2000 + parseInt(y, 10);
        lunes = new Date(year, Number(m) - 1, Number(d), 12, 0, 0, 0);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaSemanaStr)) {
        const [y, m, d] = fechaSemanaStr.split('-').map(Number);
        lunes = new Date(y, m - 1, d, 12, 0, 0, 0);
    } else {
        lunes = new Date(fechaSemanaStr);
    }

    if (!lunes || isNaN(lunes.getTime())) return [];

    const fechas = [];
    for (let i = 0; i < 7; i++) {
        const f = new Date(lunes);
        f.setDate(lunes.getDate() + i);
        fechas.push(window.isoDate(f));
    }

    return fechas;
};

window.getWeekStartISO = (iso) => {
    if (!iso) return '';
    return window.isoDate(window.getMonday(new Date(`${iso}T12:00:00`)));
};

window.getDayOffsetFromWeek = (weekStart, date) => {
    if (!weekStart || !date) return 0;
    const from = new Date(`${weekStart}T12:00:00`).getTime();
    const to = new Date(`${date}T12:00:00`).getTime();
    const diff = Math.round((to - from) / 86400000);
    return Math.max(0, Math.min(6, diff));
};

window.buildPuestoId = (hotelId, rowIndex) => `${hotelId}::${String(rowIndex).padStart(3, '0')}`;

window.normalizePreviewTurno = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (window.ExcelLoader?.shiftFromExcel) return window.ExcelLoader.shiftFromExcel(raw);
    return raw;
};

window.shortIncidencia = (value) => {
    const upper = String(value || '').toUpperCase();
    if (upper.startsWith('VAC')) return 'VAC';
    if (upper.startsWith('BAJA')) return 'BAJA';
    if (upper.startsWith('PERM')) return 'PERM';
    return upper || '';
};

window.createPuestosPreviewModel = ({
    hotel,
    dates = [],
    sourceRows = [],
    rows = [],
    eventos = [],
    employees = []
} = {}) => {
    const normalizePerson = (value) => {
        if (window.TurnosEngine?.normalizeString) return window.TurnosEngine.normalizeString(value);
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    };

    const datesSet = new Set(dates);
    const profilesByNorm = new Map();
    employees.forEach(profile => {
        [profile?.id, profile?.nombre].forEach(value => {
            const key = normalizePerson(value);
            if (key && !profilesByNorm.has(key)) profilesByNorm.set(key, profile);
        });
    });

    const getEmployeeName = (value) => {
        const norm = normalizePerson(value);
        const profile = profilesByNorm.get(norm);
        return profile?.nombre || profile?.id || String(value || '').trim();
    };

    const canonicalEmployeeId = (value) => {
        const norm = normalizePerson(value);
        const profile = profilesByNorm.get(norm);
        return normalizePerson(profile?.id || profile?.nombre || value);
    };

    const normalizarId = (id) => {
        const canonical = canonicalEmployeeId(id);
        if (canonical) return canonical;
        return String(id || '').trim().toLowerCase();
    };

    const sourceRowsByWeek = new Map();
    const puestosMap = new Map();

    sourceRows.forEach(row => {
        if (!row?.weekStart) return;

        if (!sourceRowsByWeek.has(row.weekStart)) sourceRowsByWeek.set(row.weekStart, []);
        sourceRowsByWeek.get(row.weekStart).push(row);

        const puestoId = window.buildPuestoId(hotel, row.rowIndex);
        let puesto = puestosMap.get(puestoId);
        if (!puesto) {
            puesto = {
                puesto_id: puestoId,
                hotel_id: hotel,
                rowIndex: row.rowIndex,
                label: `Puesto ${String((row.rowIndex || 0) + 1).padStart(2, '0')}`,
                excelLabel: String(row.displayName || row.empleadoId || '').trim(),
                asignaciones: {}
            };
            puestosMap.set(puestoId, puesto);
        } else if (!puesto.excelLabel) {
            puesto.excelLabel = String(row.displayName || row.empleadoId || '').trim();
        }

        for (let offset = 0; offset < 7; offset++) {
            const fecha = window.addIsoDays(row.weekStart, offset);
            if (!datesSet.has(fecha)) continue;

            puesto.asignaciones[fecha] = {
                puesto_id: puestoId,
                hotel_id: hotel,
                fecha,
                weekStart: row.weekStart,
                turno_base: window.normalizePreviewTurno(row.values?.[offset] || ''),
                titular_id: row.empleadoId || row.displayName || '',
                titular_nombre: getEmployeeName(row.displayName || row.empleadoId || ''),
                excel_label: String(row.displayName || row.empleadoId || '').trim()
            };
        }
    });

    const fechaToWeekStart = new Map();

    sourceRows.forEach(row => {
        const fechasSemana = window.getFechasSemana(row?.weekStart);
        fechasSemana.forEach(fecha => {
            if (!fechaToWeekStart.has(fecha)) fechaToWeekStart.set(fecha, row.weekStart);
        });
    });

    const puestos = Array.from(puestosMap.values()).sort((a, b) => a.rowIndex - b.rowIndex);
    const dayCache = new Map();
    const basePorEmpleado = Object.create(null);
    const baseAssignmentsByEmployeeDate = new Map();

    const normalizeDateValue = (value) => {
        if (!value) return '';
        if (window.TurnosDB?.normalizeDate) return window.TurnosDB.normalizeDate(value);
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return String(value).split('T')[0];
    };

    const normalizeEventType = (value) => {
        const type = String(value || '').toUpperCase().trim().split(' ')[0];
        if (type.startsWith('VAC')) return 'VAC';
        if (type.startsWith('BAJA')) return 'BAJA';
        if (type.startsWith('PERM')) return 'PERM';
        if (type === 'CT') return 'CAMBIO_TURNO';
        return type;
    };

    const isAbsenceType = (value) => {
        const type = normalizeEventType(value);
        return type === 'VAC' || type === 'BAJA' || type === 'PERM';
    };

    const isCambioType = (value) => {
        const type = normalizeEventType(value);
        return type === 'CAMBIO_TURNO'
            || type === 'INTERCAMBIO_TURNO'
            || type === 'REFUERZO'
            || type === 'CAMBIO_HOTEL'
            || type === 'INTERCAMBIO_HOTEL'
            || type === 'CAMBIO_POSICION'
            || type === 'INTERCAMBIO_POSICION';
    };

    const isDateInRange = (fecha, desde, hasta) => {
        const target = normalizeDateValue(fecha);
        const start = normalizeDateValue(desde) || target;
        const end = normalizeDateValue(hasta) || start;
        return Boolean(target && start && start <= target && target <= end);
    };

    const getSortStamp = (item) => String(
        item?.updated_at
        || item?.created_at
        || item?.fecha
        || item?.fecha_inicio
        || ''
    );

    const getEventDestinationId = (event) => (
        event?.empleado_destino_id
        || event?.sustituto
        || event?.sustituto_id
        || event?.payload?.empleado_destino_id
        || event?.payload?.sustituto_id
        || event?.payload?.sustituto
        || ''
    );

    const getEventTurnoValue = (event) => (
        event?.turno_nuevo
        || event?.payload?.turno_nuevo
        || event?.turno
        || event?.payload?.turno
        || event?.turno_original
        || event?.payload?.turno_original
        || ''
    );

    const rowsByEmployeeDate = new Map();
    rows.forEach(row => {
        const employeeNorm = canonicalEmployeeId(row?.empleado_id);
        const fecha = normalizeDateValue(row?.fecha);
        if (!employeeNorm || !fecha) return;

        const key = `${employeeNorm}|${fecha}`;
        if (!rowsByEmployeeDate.has(key)) rowsByEmployeeDate.set(key, []);
        rowsByEmployeeDate.get(key).push(row);
    });

    const eventsByEmployee = new Map();
    const registerEventForEmployee = (employeeId, evento) => {
        const employeeNorm = canonicalEmployeeId(employeeId);
        if (!employeeNorm) return;
        if (!eventsByEmployee.has(employeeNorm)) eventsByEmployee.set(employeeNorm, []);
        eventsByEmployee.get(employeeNorm).push(evento);
    };

    eventos.forEach(evento => {
        registerEventForEmployee(evento?.empleado_id, evento);
        registerEventForEmployee(getEventDestinationId(evento), evento);
    });

    const getRawRowsForEmployeeDate = (empleadoId, fecha) => {
        const employeeNorm = canonicalEmployeeId(empleadoId);
        const day = normalizeDateValue(fecha);
        if (!employeeNorm || !day) return [];
        return rowsByEmployeeDate.get(`${employeeNorm}|${day}`) || [];
    };

    const getActiveEventsForEmployeeDate = (empleadoId, fecha) => {
        const employeeNorm = canonicalEmployeeId(empleadoId);
        if (!employeeNorm || !fecha) return [];
        return (eventsByEmployee.get(employeeNorm) || []).filter((evento, index, source) => {
            if ((evento?.estado || 'activo') === 'anulado') return false;
            if (source.findIndex(item => item?.id === evento?.id && item?.fecha_inicio === evento?.fecha_inicio) !== index) return false;
            return isDateInRange(fecha, evento?.fecha_inicio, evento?.fecha_fin);
        });
    };

    const pickLatestByPriority = (items, getPriority) => {
        if (!items.length) return null;
        return [...items].sort((a, b) => {
            const priorityDiff = (getPriority(b) || 0) - (getPriority(a) || 0);
            if (priorityDiff !== 0) return priorityDiff;
            return getSortStamp(b).localeCompare(getSortStamp(a));
        })[0] || null;
    };

    const resolveCambioFromStates = (candidates, turnoBase) => {
        const turnoBaseNorm = window.normalizePreviewTurno(turnoBase || '');

        for (const state of candidates) {
            if (!state || state.isAbsence) continue;

            const turnoFinal = window.normalizePreviewTurno(state.turnoFinal || '');
            const sourceReason = String(state.sourceReason || '').toUpperCase();
            const isCambioExplicito = sourceReason.includes('CAMBIO')
                || sourceReason.includes('INTERCAMBIO')
                || sourceReason.includes('OVERRIDE')
                || sourceReason.includes('REFUERZO');

            if (turnoFinal && turnoFinal !== turnoBaseNorm && (state.isModified || isCambioExplicito)) {
                return {
                    nuevo_turno: turnoFinal,
                    state
                };
            }
        }

        return null;
    };

    const buildDayContext = (date) => {
        if (dayCache.has(date)) return dayCache.get(date);

        const weekStart = fechaToWeekStart.get(date) || null;
        const fechasSemana = weekStart ? window.getFechasSemana(weekStart) : [];
        const sourceIndex = Math.max(0, fechasSemana.indexOf(date));
        const weekSourceRows = weekStart ? (sourceRowsByWeek.get(weekStart) || []) : [];
        const dayRoster = window.TurnosEngine.buildDayRoster({
            rows,
            events: eventos,
            employees,
            date,
            hotel,
            sourceRows: weekSourceRows,
            sourceIndex
        });

        const byEmployee = new Map();
        const coversByTitular = new Map();

        dayRoster.forEach(entry => {
            const norm = canonicalEmployeeId(entry?.id || entry?.name || entry?.displayAs);
            if (norm) byEmployee.set(norm, entry);

            const coveredEmployee = canonicalEmployeeId(entry?._finalState?.coversEmployeeId || entry?.substituting);
            if (coveredEmployee && !coversByTitular.has(coveredEmployee)) {
                coversByTitular.set(coveredEmployee, entry);
            }
        });

        const context = { dayRoster, byEmployee, coversByTitular, weekStart, sourceIndex };
        dayCache.set(date, context);
        return context;
    };

    const getPuesto = (puestoId) => puestosMap.get(puestoId) || null;

    const getAsignacionPuesto = (puestoId, fecha) => {
        const puesto = getPuesto(puestoId);
        if (!puesto) return null;
        return puesto.asignaciones[fecha] || {
            puesto_id: puestoId,
            hotel_id: hotel,
            fecha,
            turno_base: '',
            titular_id: '',
            titular_nombre: puesto.excelLabel || ''
        };
    };

    const getEmployeeContext = (empleadoId, fecha) => {
        const employeeNorm = canonicalEmployeeId(empleadoId);
        const dayContext = buildDayContext(fecha);
        const entry = employeeNorm ? dayContext.byEmployee.get(employeeNorm) : null;
        return {
            norm: employeeNorm,
            dayContext,
            entry,
            state: entry?._finalState || null
        };
    };

    const getTurnoBase = (puestoId, fecha) => {
        const asignacion = getAsignacionPuesto(puestoId, fecha);
        return window.normalizePreviewTurno(asignacion?.turno_base || '');
    };

    const getTitularAsignado = (puestoId, fecha) => {
        const asignacion = getAsignacionPuesto(puestoId, fecha);
        if (!asignacion) return { id: '', nombre: '' };

        const titularId = asignacion.titular_id || asignacion.titular_nombre || '';
        return {
            id: titularId,
            nombre: getEmployeeName(titularId || asignacion.titular_nombre || '')
        };
    };

    puestos.forEach(puesto => {
        Object.entries(puesto.asignaciones || {}).forEach(([fecha, asignacion]) => {
            const titularId = asignacion?.titular_id || asignacion?.titular_nombre || '';
            const turnoBaseAsignado = window.normalizePreviewTurno(asignacion?.turno_base || '');
            const assignmentData = {
                empleado_id: titularId,
                fecha,
                turno: turnoBaseAsignado,
                puesto_id: puesto.puesto_id,
                hotel_id: hotel,
                titular: getEmployeeName(titularId || asignacion?.titular_nombre || ''),
                titular_id: titularId
            };
            const aliasCandidates = [
                asignacion?.titular_id,
                asignacion?.titular_nombre,
                getEmployeeName(titularId || asignacion?.titular_nombre || '')
            ];

            aliasCandidates.forEach(alias => {
                const employeeNorm = normalizarId(alias);
                if (!employeeNorm || !fecha) return;

                if (!basePorEmpleado[employeeNorm]) basePorEmpleado[employeeNorm] = Object.create(null);
                if (typeof basePorEmpleado[employeeNorm][fecha] === 'undefined') {
                    basePorEmpleado[employeeNorm][fecha] = turnoBaseAsignado;
                }

                const key = `${employeeNorm}|${fecha}`;
                if (!baseAssignmentsByEmployeeDate.has(key)) baseAssignmentsByEmployeeDate.set(key, []);

                const existing = baseAssignmentsByEmployeeDate.get(key).some(item => item.puesto_id === puesto.puesto_id);
                if (!existing) {
                    baseAssignmentsByEmployeeDate.get(key).push({
                        ...assignmentData,
                        employee_norm: employeeNorm
                    });
                }
            });
        });
    });

    const getBaseAssignmentsForEmployeeDate = (empleadoId, fecha) => {
        const employeeNorm = normalizarId(empleadoId);
        if (!employeeNorm || !fecha) return [];
        return baseAssignmentsByEmployeeDate.get(`${employeeNorm}|${fecha}`) || [];
    };

    const getPrimaryBaseAssignmentForEmployeeDate = (empleadoId, fecha) =>
        getBaseAssignmentsForEmployeeDate(empleadoId, fecha)[0] || null;

    const getTurnoBaseDeEmpleado = (empleadoId, fecha) => {
        const employeeNorm = normalizarId(empleadoId);
        if (!employeeNorm || !fecha) return null;
        return basePorEmpleado[employeeNorm]?.[fecha] ?? null;
    };

    const getIncidencia = (titularId, fecha) => {
        const titularContext = getEmployeeContext(titularId, fecha);
        const rawRows = getRawRowsForEmployeeDate(titularId, fecha).filter(row => isAbsenceType(row?.tipo));
        const rowMatch = pickLatestByPriority(rawRows, row => {
            const tipo = normalizeEventType(row?.tipo);
            return tipo === 'BAJA' ? 3 : (tipo === 'PERM' ? 2 : 1);
        });
        if (rowMatch) {
            return {
                tipo: normalizeEventType(rowMatch.tipo),
                row: rowMatch,
                entry: titularContext.entry,
                state: titularContext.state
            };
        }

        const rawEvents = getActiveEventsForEmployeeDate(titularId, fecha).filter(evento => isAbsenceType(evento?.tipo));
        const eventMatch = pickLatestByPriority(rawEvents, evento => {
            const tipo = normalizeEventType(evento?.tipo);
            return tipo === 'BAJA' ? 3 : (tipo === 'PERM' ? 2 : 1);
        });
        if (eventMatch) {
            return {
                tipo: normalizeEventType(eventMatch.tipo),
                event: eventMatch,
                entry: titularContext.entry,
                state: titularContext.state
            };
        }

        const { entry, state } = titularContext;
        if (!state?.isAbsence) return null;

        return {
            tipo: window.shortIncidencia(state.estadoFinal || entry?.cell?.tipo),
            entry,
            state
        };
    };

    const getCobertura = (titularId, fecha) => {
        const rawRows = getRawRowsForEmployeeDate(titularId, fecha);
        const rowMatch = pickLatestByPriority(
            rawRows.filter(row => (isAbsenceType(row?.tipo) || normalizeEventType(row?.tipo) === 'COBERTURA') && row?.sustituto),
            row => isAbsenceType(row?.tipo) ? 2 : 1
        );
        if (rowMatch) {
            const sustitutoId = rowMatch.sustituto;
            const sustitutoContext = getEmployeeContext(sustitutoId, fecha);
            return {
                empleado_id: sustitutoId,
                nombre: getEmployeeName(sustitutoId),
                row: rowMatch,
                entry: sustitutoContext.entry,
                state: sustitutoContext.state
            };
        }

        const rawEvents = getActiveEventsForEmployeeDate(titularId, fecha);
        const eventMatch = pickLatestByPriority(
            rawEvents.filter(evento => {
                const tipo = normalizeEventType(evento?.tipo);
                return (isAbsenceType(tipo) || tipo === 'COBERTURA') && getEventDestinationId(evento);
            }),
            evento => isAbsenceType(evento?.tipo) ? 2 : 1
        );
        if (eventMatch) {
            const sustitutoId = getEventDestinationId(eventMatch);
            const sustitutoContext = getEmployeeContext(sustitutoId, fecha);
            return {
                empleado_id: sustitutoId,
                nombre: getEmployeeName(sustitutoId),
                event: eventMatch,
                entry: sustitutoContext.entry,
                state: sustitutoContext.state
            };
        }

        const titularContext = getEmployeeContext(titularId, fecha);
        const coberturaEntry = titularContext.norm ? titularContext.dayContext.coversByTitular.get(titularContext.norm) : null;
        const coberturaState = coberturaEntry?._finalState || null;
        if (!coberturaState) return null;

        const sustitutoId = coberturaState.employeeId || coberturaEntry?.id || coberturaEntry?.displayAs || '';
        return {
            empleado_id: sustitutoId,
            nombre: getEmployeeName(sustitutoId),
            entry: coberturaEntry,
            state: coberturaState
        };
    };

    const getCambioTurno = (titularId, fecha, { turnoBase = '', cobertura = null } = {}) => {
        const turnoBaseNorm = window.normalizePreviewTurno(turnoBase || '');
        const rawRows = getRawRowsForEmployeeDate(titularId, fecha);
        const rowMatch = pickLatestByPriority(
            rawRows.filter(row => {
                if (row?.evento_id) return false;
                const tipo = normalizeEventType(row?.tipo);
                const turnoNuevo = window.normalizePreviewTurno(row?.turno || row?.turno_nuevo || '');
                return (tipo === 'CAMBIO_TURNO' || tipo === 'NORMAL') && turnoNuevo && turnoNuevo !== turnoBaseNorm;
            }),
            row => normalizeEventType(row?.tipo) === 'CAMBIO_TURNO' ? 2 : 1
        );
        if (rowMatch) {
            return {
                nuevo_turno: window.normalizePreviewTurno(rowMatch.turno || rowMatch.turno_nuevo || ''),
                row: rowMatch
            };
        }

        const rawEvents = getActiveEventsForEmployeeDate(titularId, fecha);
        const eventMatch = pickLatestByPriority(
            rawEvents.filter(evento => isCambioType(evento?.tipo)),
            evento => {
                const tipo = normalizeEventType(evento?.tipo);
                return tipo.includes('INTERCAMBIO') ? 3 : (tipo === 'CAMBIO_TURNO' ? 2 : 1);
            }
        );
        if (eventMatch) {
            const turnoEvento = window.normalizePreviewTurno(getEventTurnoValue(eventMatch));
            if (turnoEvento && turnoEvento !== turnoBaseNorm) {
                return {
                    nuevo_turno: turnoEvento,
                    tipo: normalizeEventType(eventMatch.tipo),
                    empleado_a: eventMatch.empleado_id || '',
                    empleado_b: getEventDestinationId(eventMatch),
                    event: eventMatch
                };
            }
            if (String(normalizeEventType(eventMatch.tipo)).includes('INTERCAMBIO')) {
                return {
                    nuevo_turno: '',
                    tipo: normalizeEventType(eventMatch.tipo),
                    empleado_a: eventMatch.empleado_id || '',
                    empleado_b: getEventDestinationId(eventMatch),
                    event: eventMatch
                };
            }
        }

        const titularContext = getEmployeeContext(titularId, fecha);
        const candidates = [];

        if (cobertura?.state) candidates.push(cobertura.state);
        if (titularContext.state) candidates.push(titularContext.state);

        return resolveCambioFromStates(candidates, turnoBase);
    };

    const getCelda = (puestoId, fecha) => {
        const puesto = getPuesto(puestoId);
        if (!puesto) {
            return {
                turno: '',
                titular: '',
                real: '',
                incidencia: null,
                puesto_id: puestoId,
                hotel_id: hotel,
                fecha
            };
        }

        const asignacion = getAsignacionPuesto(puestoId, fecha);
        const turnoBase = getTurnoBase(puestoId, fecha);
        const titularAsignado = getTitularAsignado(puestoId, fecha);
        const titularContext = getEmployeeContext(titularAsignado.id, fecha);

        const resultado = {
            turno: turnoBase,
            titular: titularAsignado.nombre,
            real: titularAsignado.nombre,
            incidencia: null
        };

        const incidencia = getIncidencia(titularAsignado.id, fecha);
        if (incidencia) {
            resultado.incidencia = incidencia.tipo;

            if (incidencia.tipo === 'VAC' || incidencia.tipo === 'BAJA') {
                resultado.turno = null;
            } else if (!incidencia.state?.turnoFinal) {
                resultado.turno = null;
            }
        }

        const cobertura = getCobertura(titularAsignado.id, fecha);
        if (cobertura) {
            resultado.real = cobertura.nombre;

            if (resultado.turno === null) {
                resultado.turno = turnoBase;
            }
        }

        const cambio = getCambioTurno(titularAsignado.id, fecha, {
            turnoBase,
            cobertura
        });
        if (cambio) {
            if (cambio.nuevo_turno) {
                resultado.turno = cambio.nuevo_turno;
            } else if (String(cambio.tipo || '').includes('INTERCAMBIO')) {
                const realEmpleadoId = cobertura?.empleado_id || titularAsignado.id || '';
                const realEmpleadoNorm = canonicalEmployeeId(realEmpleadoId);
                const empleadoANorm = canonicalEmployeeId(cambio.empleado_a);
                const empleadoBNorm = canonicalEmployeeId(cambio.empleado_b);

                if (realEmpleadoNorm && empleadoANorm && realEmpleadoNorm === empleadoANorm) {
                    const turnoIntercambiado = getTurnoBaseDeEmpleado(cambio.empleado_b, fecha);
                    if (turnoIntercambiado) resultado.turno = turnoIntercambiado;
                } else if (realEmpleadoNorm && empleadoBNorm && realEmpleadoNorm === empleadoBNorm) {
                    const turnoIntercambiado = getTurnoBaseDeEmpleado(cambio.empleado_a, fecha);
                    if (turnoIntercambiado) resultado.turno = turnoIntercambiado;
                }
            }
        }

        if (!resultado.turno && !resultado.incidencia) {
            resultado.turno = turnoBase;
        }

        const realId = cobertura?.empleado_id || titularAsignado.id || '';
        const finalState = cambio?.state || cobertura?.state || incidencia?.state || titularContext.state || null;

        return {
            turno: resultado.turno,
            titular: resultado.titular,
            real: resultado.real,
            incidencia: resultado.incidencia,
            puesto_id: puestoId,
            hotel_id: hotel,
            fecha,
            turno_base: turnoBase,
            titular_id: titularAsignado.id || titularContext.state?.employeeId || '',
            real_id: realId,
            cobertura: Boolean(cobertura),
            cambio: Boolean(cambio),
            puesto,
            _titularState: titularContext.state || null,
            _realState: cobertura?.state || null,
            _finalState: finalState
        };
    };

    const coverageAssignmentsCache = new Map();
    const employeeDayCache = new Map();
    const visibleEmployeesCache = new Map();
    const vacacionesCache = new Map();
    const orderedEmployeesCache = new Map();
    let employeesCache = null;

    const getCoverageAssignmentsForEmployeeDate = (empleadoId, fecha) => {
        const employeeNorm = canonicalEmployeeId(empleadoId);
        if (!employeeNorm || !fecha) return [];

        if (!coverageAssignmentsCache.has(fecha)) {
            const bySubstitute = new Map();

            puestos.forEach(puesto => {
                const titular = getTitularAsignado(puesto.puesto_id, fecha);
                if (!titular?.id) return;

                const cobertura = getCobertura(titular.id, fecha);
                if (!cobertura?.empleado_id) return;

                const substituteNorm = canonicalEmployeeId(cobertura.empleado_id);
                if (!substituteNorm) return;

                if (!bySubstitute.has(substituteNorm)) bySubstitute.set(substituteNorm, []);
                bySubstitute.get(substituteNorm).push({
                    puesto_id: puesto.puesto_id,
                    hotel_id: hotel,
                    fecha,
                    turno_puesto: getTurnoBase(puesto.puesto_id, fecha),
                    titular: titular.nombre,
                    titular_id: titular.id,
                    real: cobertura.nombre,
                    real_id: cobertura.empleado_id
                });
            });

            coverageAssignmentsCache.set(fecha, bySubstitute);
        }

        return coverageAssignmentsCache.get(fecha).get(employeeNorm) || [];
    };

    const resolverCambioFinal = (empleadoId, fecha, turnoActual) => {
        const cambio = getCambioTurno(empleadoId, fecha, { turnoBase: turnoActual });
        if (!cambio) return { turno: turnoActual, cambio: false, detalle: null };

        const tipoCambio = String(cambio.tipo || cambio.event?.tipo || '').toUpperCase();
        if (tipoCambio.includes('INTERCAMBIO')) {
            const empleadoNorm = normalizarId(empleadoId);
            const empleadoANorm = normalizarId(cambio.empleado_a);
            const empleadoBNorm = normalizarId(cambio.empleado_b);
            let otroEmpleado = null;

            if (empleadoNorm === empleadoANorm) {
                otroEmpleado = cambio.empleado_b;
            } else if (empleadoNorm === empleadoBNorm) {
                otroEmpleado = cambio.empleado_a;
            } else {
                console.log('[resolverCambioFinal] empleado no coincide con participantes del intercambio', {
                    fecha,
                    empleado: empleadoId,
                    empleado_normalizado: empleadoNorm,
                    empleado_a: cambio.empleado_a,
                    empleado_a_normalizado: empleadoANorm,
                    empleado_b: cambio.empleado_b,
                    empleado_b_normalizado: empleadoBNorm
                });
                return { turno: turnoActual, cambio: false, detalle: cambio };
            }

            const turnoIntercambiado = getTurnoBaseDeEmpleado(otroEmpleado, fecha);

            if (turnoIntercambiado) {
                return {
                    turno: turnoIntercambiado,
                    cambio: turnoIntercambiado !== turnoActual,
                    detalle: cambio
                };
            }

            console.log('[resolverCambioFinal] turno base no encontrado para intercambio', {
                fecha,
                empleado: empleadoId,
                empleado_normalizado: empleadoNorm,
                empleado_a: cambio.empleado_a,
                empleado_a_normalizado: empleadoANorm,
                empleado_b: cambio.empleado_b,
                empleado_b_normalizado: empleadoBNorm,
                otro_empleado: otroEmpleado,
                otro_empleado_normalizado: normalizarId(otroEmpleado),
                base_actual: basePorEmpleado[empleadoNorm] || null,
                base_otro: basePorEmpleado[normalizarId(otroEmpleado)] || null
            });
        }

        if (cambio.nuevo_turno) {
            return {
                turno: cambio.nuevo_turno,
                cambio: cambio.nuevo_turno !== turnoActual,
                detalle: cambio
            };
        }

        return { turno: turnoActual, cambio: false, detalle: cambio };
    };

    const resolverTurnoFinal = (empleadoId, fecha) => {
        const baseAssignments = getBaseAssignmentsForEmployeeDate(empleadoId, fecha);
        const coverageAssignments = getCoverageAssignmentsForEmployeeDate(empleadoId, fecha);
        const resultados = [];

        if (!coverageAssignments.length) {
            baseAssignments.forEach(baseAssignment => {
            const incidencia = getIncidencia(baseAssignment.titular_id, fecha);
            const cobertura = getCobertura(baseAssignment.titular_id, fecha);
            const turnoBase = baseAssignment.turno || '';
            let turno = turnoBase;
            let real = baseAssignment.titular;
            let realId = baseAssignment.titular_id;

            if (incidencia) {
                turno = null;
            }

            if (cobertura) {
                real = cobertura.nombre;
                realId = cobertura.empleado_id;
            }

            if (!incidencia) {
                const cambioFinal = resolverCambioFinal(baseAssignment.titular_id, fecha, turnoBase);
                turno = cambioFinal.turno;
            }

            resultados.push({
                turno,
                turno_base: turnoBase,
                titular: baseAssignment.titular,
                real,
                incidencia: incidencia?.tipo || null,
                puesto_id: baseAssignment.puesto_id,
                hotel_id: baseAssignment.hotel_id,
                fecha,
                titular_id: baseAssignment.titular_id,
                real_id: realId,
                rol: 'titular',
                cambio: Boolean(turno && turnoBase && turno !== turnoBase),
                sin_cubrir: Boolean(incidencia && (!cobertura?.empleado_id || realId === baseAssignment.titular_id)),
                cubierto_por: cobertura?.empleado_id ? real : '',
                sustituye_a: null
            });
            });
        }

        coverageAssignments.forEach(coverageAssignment => {
            const ownBase = getPrimaryBaseAssignmentForEmployeeDate(empleadoId, fecha);
            const turnoBasePropio = ownBase?.turno || '';
            let turno = coverageAssignment.turno_puesto || '';

            const cambioFinal = resolverCambioFinal(empleadoId, fecha, turno);
            turno = cambioFinal.turno;

            resultados.push({
                turno,
                turno_base: turnoBasePropio,
                titular: coverageAssignment.titular,
                real: coverageAssignment.real,
                incidencia: null,
                puesto_id: coverageAssignment.puesto_id,
                hotel_id: coverageAssignment.hotel_id,
                fecha,
                titular_id: coverageAssignment.titular_id,
                real_id: coverageAssignment.real_id,
                rol: 'sustituto',
                cambio: Boolean(turno && turnoBasePropio && turno !== turnoBasePropio),
                sin_cubrir: false,
                cubierto_por: '',
                sustituye_a: coverageAssignment.titular
            });
        });

        if (!resultados.length) {
            const ownBase = getPrimaryBaseAssignmentForEmployeeDate(empleadoId, fecha);
            const incidencia = getIncidencia(empleadoId, fecha);
            if (incidencia) {
                resultados.push({
                    turno: null,
                    turno_base: ownBase?.turno || '',
                    titular: getEmployeeName(empleadoId),
                    real: getEmployeeName(empleadoId),
                    incidencia: incidencia.tipo,
                    puesto_id: ownBase?.puesto_id || '',
                    hotel_id: hotel,
                    fecha,
                    titular_id: ownBase?.titular_id || empleadoId,
                    real_id: ownBase?.titular_id || empleadoId,
                    rol: 'titular',
                    cambio: false,
                    sin_cubrir: true,
                    cubierto_por: '',
                    sustituye_a: null
                });
            }
        }

        return resultados;
    };

    const buildEmployeeResult = (empleadoId, fecha) => {
        const employeeNorm = canonicalEmployeeId(empleadoId);
        if (!employeeNorm || !fecha) return null;

        const cacheKey = `${employeeNorm}|${fecha}`;
        if (employeeDayCache.has(cacheKey)) return employeeDayCache.get(cacheKey);

        const matches = resolverTurnoFinal(empleadoId, fecha);

        let result = null;
        if (matches.length > 1) {
            result = {
                conflicto: true,
                empleado_id: empleadoId,
                fecha,
                detalles: matches
            };
        } else {
            result = matches[0] || null;
        }

        employeeDayCache.set(cacheKey, result);
        return result;
    };

    const buildEmployees = () => {
        if (employeesCache) return employeesCache;

        const byEmployee = new Map();
        const registerEmployee = (employeeId, fallbackName, order) => {
            const norm = canonicalEmployeeId(employeeId || fallbackName);
            if (!norm) return;

            const profile = profilesByNorm.get(norm);
            const current = byEmployee.get(norm);
            const name = getEmployeeName(employeeId || fallbackName);
            const next = {
                employee_id: profile?.id || name,
                displayName: profile?.nombre || name,
                hotel_id: hotel,
                sortOrder: Math.min(current?.sortOrder ?? Number.MAX_SAFE_INTEGER, order)
            };
            byEmployee.set(norm, next);
        };

        puestos.forEach(puesto => {
            const asignaciones = Object.values(puesto.asignaciones || {});
            asignaciones.forEach(asignacion => registerEmployee(asignacion.titular_id, asignacion.titular_nombre, puesto.rowIndex * 10));
        });

        dates.forEach((fecha, dateIndex) => {
            puestos.forEach(puesto => {
                const celda = getCelda(puesto.puesto_id, fecha);
                const titularNorm = canonicalEmployeeId(celda.titular_id || celda.titular);
                const realNorm = canonicalEmployeeId(celda.real_id || celda.real);
                if (realNorm && realNorm !== titularNorm) {
                    registerEmployee(celda.real_id, celda.real, (puesto.rowIndex * 10) + dateIndex + 1);
                }
            });
        });

        employees.forEach(profile => {
            const hotelKey = window.TurnosEngine?.normalizeHotelKey
                ? window.TurnosEngine.normalizeHotelKey(profile.hotel_id || profile.hotel)
                : String(profile.hotel_id || profile.hotel || '').toLowerCase();
            const modelHotelKey = window.TurnosEngine?.normalizeHotelKey
                ? window.TurnosEngine.normalizeHotelKey(hotel)
                : String(hotel || '').toLowerCase();
            if (hotelKey === modelHotelKey) {
                registerEmployee(profile.id || profile.nombre, profile.nombre || profile.id, 99999);
            }
        });

        employeesCache = Array.from(byEmployee.values()).sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            return a.displayName.localeCompare(b.displayName);
        });

        return employeesCache;
    };

    const getFechasEnRango = (fechaInicio, fechaFin) => {
        const start = fechaInicio || dates[0] || '';
        const end = fechaFin || dates[dates.length - 1] || start;
        return dates.filter(fecha => (!start || fecha >= start) && (!end || fecha <= end));
    };

    const hasBaseAssignmentInRange = (employeeId, fechasRango) => {
        const employeeNorm = canonicalEmployeeId(employeeId);
        if (!employeeNorm || !fechasRango.length) return false;

        return puestos.some(puesto => fechasRango.some(fecha => {
            const asignacion = puesto?.asignaciones?.[fecha];
            if (!asignacion) return false;
            const titularNorm = canonicalEmployeeId(asignacion.titular_id || asignacion.titular_nombre);
            return Boolean(titularNorm && titularNorm === employeeNorm);
        }));
    };

    const hasRelevantActivityInRange = (employeeId, fechasRango) => {
        if (!employeeId || !fechasRango.length) return false;

        return fechasRango.some(fecha => {
            const turnoEmpleado = buildEmployeeResult(employeeId, fecha);
            if (turnoEmpleado) return true;

            const { entry, state } = getEmployeeContext(employeeId, fecha);
            if (state?.isAbsence) return true;

            const incidencia = window.shortIncidencia(state?.estadoFinal || entry?.cell?.tipo || '');
            if (incidencia === 'VAC' || incidencia === 'BAJA' || incidencia === 'PERM') return true;

            if (window.normalizePreviewTurno(state?.turnoFinal || entry?.cell?.turno || '')) return true;
            if (state?.coversEmployeeId || entry?.substituting) return true;

            return false;
        });
    };

    const getEmpleadosVisibles = (fechaInicio, fechaFin) => {
        const cacheKey = `${fechaInicio || ''}|${fechaFin || ''}`;
        if (visibleEmployeesCache.has(cacheKey)) return visibleEmployeesCache.get(cacheKey);

        const fechasRango = getFechasEnRango(fechaInicio, fechaFin);
        const visibles = buildEmployees().filter(employee => {
            const employeeId = employee?.employee_id || employee?.displayName || '';
            return hasBaseAssignmentInRange(employeeId, fechasRango)
                || hasRelevantActivityInRange(employeeId, fechasRango);
        });

        visibleEmployeesCache.set(cacheKey, visibles);
        return visibles;
    };

    const estaDeVacaciones = (empleadoId, fechas = []) => {
        const employeeNorm = canonicalEmployeeId(empleadoId);
        const fechasRango = Array.isArray(fechas) ? fechas.filter(Boolean) : [];
        const cacheKey = `${employeeNorm}|${fechasRango.join(',')}`;
        if (vacacionesCache.has(cacheKey)) return vacacionesCache.get(cacheKey);

        const result = Boolean(employeeNorm) && fechasRango.some(fecha => {
            const turnoEmpleado = buildEmployeeResult(empleadoId, fecha);
            return turnoEmpleado?.rol === 'titular' && turnoEmpleado?.incidencia === 'VAC';
        });

        vacacionesCache.set(cacheKey, result);
        return result;
    };

    const ordenarEmpleados = (empleados, fechas = []) => {
        const fechasRango = Array.isArray(fechas) ? fechas.filter(Boolean) : [];
        const employeeList = Array.isArray(empleados) ? empleados : [];
        const cacheKey = `${employeeList.map(emp => canonicalEmployeeId(emp?.employee_id || emp?.displayName || '')).join('|')}|${fechasRango.join(',')}`;
        if (orderedEmployeesCache.has(cacheKey)) return orderedEmployeesCache.get(cacheKey);

        const activos = [];
        const vacaciones = [];

        employeeList.forEach(employee => {
            const employeeId = employee?.employee_id || employee?.displayName || '';
            const isOnVacation = estaDeVacaciones(employeeId, fechasRango);
            const enriched = {
                ...employee,
                isOnVacationVisibleRange: isOnVacation
            };

            if (isOnVacation) {
                vacaciones.push(enriched);
            } else {
                activos.push(enriched);
            }
        });

        const ordered = [...activos, ...vacaciones];
        orderedEmployeesCache.set(cacheKey, ordered);
        return ordered;
    };

    return {
        hotel,
        dates,
        puestos,
        getPuesto,
        getCelda,
        getTurnoEmpleado: buildEmployeeResult,
        getEmployees: buildEmployees,
        getEmpleadosVisibles,
        estaDeVacaciones,
        ordenarEmpleados,
        getEmployeeName
    };
};

window.buildPuestoCellTitle = (celda) => {
    const parts = [
        `Puesto: ${celda.puesto_id}`,
        `Base: ${celda.turno_base || '—'}`,
        `Titular: ${celda.titular || '—'}`
    ];

    if (celda.incidencia) parts.push(`Incidencia: ${celda.incidencia}`);
    if (celda.real && celda.real !== celda.titular) parts.push(`Real: ${celda.real}`);
    if (celda.cambio && celda.turno !== celda.turno_base) {
        parts.push(`Cambio: ${celda.turno_base || '—'} -> ${celda.turno || '—'}`);
    }

    return parts.join('\n');
};

window.renderPuestoRowHeader = (puesto, referenceDate) => {
    const referencia = puesto?.asignaciones?.[referenceDate] || Object.values(puesto?.asignaciones || {})[0] || {};
    return `
        <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-weight:800; color:#0f172a; font-size:0.82rem;">${escapeHtml(puesto?.label || puesto?.puesto_id || 'Puesto')}</span>
            <span style="color:#64748b; font-size:0.72rem;">${escapeHtml(referencia.titular_nombre || puesto?.excelLabel || 'Sin titular')}</span>
        </div>
    `;
};

window.renderPuestoCell = (celda) => {
    const shiftKey = window.TurnosRules?.shiftKey(celda.turno || celda.turno_base, 'NORMAL') || 'empty';
    const def = window.TurnosRules?.definitions?.[shiftKey] || window.TurnosRules?.definitions?.empty || { adminStyle: '' };
    const replacementLine = celda.real && celda.real !== celda.titular
        ? `<div style="font-size:0.72rem; font-weight:700; color:#0f172a;">&rarr; ${escapeHtml(celda.real)}</div>`
        : '';
    const changeLine = !replacementLine && celda.cambio && celda.turno_base && celda.turno !== celda.turno_base
        ? `<div style="font-size:0.68rem; color:#64748b;">Base ${escapeHtml(celda.turno_base)}</div>`
        : '';

    return `
        <div title="${escapeHtml(window.buildPuestoCellTitle(celda))}" style="display:flex; flex-direction:column; gap:6px; min-height:82px; padding:10px 8px; border-radius:12px; background:#ffffff;">
            <div style="display:inline-flex; align-items:center; justify-content:center; padding:8px 6px; border-radius:10px; font-size:0.8rem; font-weight:800; ${def.adminStyle || 'background:#f8fafc; color:#1e293b; border:1px solid #e2e8f0;'}">
                ${escapeHtml(celda.turno || celda.turno_base || '—')}
            </div>
            <div style="font-size:0.73rem; line-height:1.25; color:#334155; font-weight:700;">
                ${escapeHtml(celda.titular || 'Sin titular')}${celda.incidencia ? ` <span style="color:#b45309;">(${escapeHtml(celda.incidencia)})</span>` : ''}
            </div>
            ${replacementLine}
            ${changeLine}
        </div>
    `;
};

window.getCelda = (puesto_id, fecha) => {
    const model = window._previewPuestosModels?.[puesto_id];
    if (!model?.getCelda) {
        return { turno: '', titular: '', real: '', incidencia: null, puesto_id, fecha };
    }
    return model.getCelda(puesto_id, fecha);
};

window.getTurnoEmpleado = (empleado_id, fecha) => {
    const models = new Set(Object.values(window._previewPuestosModels || {}));
    const resultados = [];
    for (const model of models) {
        if (!model?.getTurnoEmpleado) continue;
        const result = model.getTurnoEmpleado(empleado_id, fecha);
        if (!result) continue;
        if (result.conflicto) {
            resultados.push(...(result.detalles || []));
        } else {
            resultados.push(result);
        }
    }
    if (resultados.length > 1) {
        return {
            conflicto: true,
            empleado_id,
            fecha,
            detalles: resultados
        };
    }
    return resultados[0] || null;
};

window.detectarErrores = (previewModel) => {
    if (!previewModel) return [];

    const errores = [];
    const warnError = (detalle) => {
        errores.push(detalle);
        console.warn('ERROR:', detalle);
    };

    const employees = previewModel.getEmployees ? previewModel.getEmployees() : [];
    const fechas = Array.isArray(previewModel.dates) ? previewModel.dates : [];

    employees.forEach(employee => {
        fechas.forEach(fecha => {
            const turnoEmpleado = previewModel.getTurnoEmpleado(employee.employee_id, fecha);
            if (turnoEmpleado?.conflicto) {
                warnError({
                    tipo: 'doble_turno_mismo_dia',
                    empleado_id: employee.employee_id,
                    fecha,
                    detalles: turnoEmpleado.detalles
                });
            }
        });
    });

    previewModel.puestos.forEach(puesto => {
        fechas.forEach(fecha => {
            const celda = previewModel.getCelda(puesto.puesto_id, fecha);
            if (!celda) return;

            if (celda.incidencia && (!celda.real || celda.real === celda.titular)) {
                warnError({
                    tipo: 'turno_sin_cubrir',
                    fecha,
                    puesto_id: puesto.puesto_id,
                    titular: celda.titular,
                    incidencia: celda.incidencia
                });
            }

            if (celda.real && celda.real !== celda.titular && !celda.incidencia) {
                warnError({
                    tipo: 'sustitucion_sin_incidencia',
                    fecha,
                    puesto_id: puesto.puesto_id,
                    titular: celda.titular,
                    real: celda.real
                });
            }

            if (celda.incidencia && celda._titularState && !celda._titularState.isAbsence) {
                warnError({
                    tipo: 'incidencia_sin_efecto',
                    fecha,
                    puesto_id: puesto.puesto_id,
                    titular: celda.titular,
                    incidencia: celda.incidencia
                });
            }
        });
    });

    return errores;
};

window.validarPreviewModel = (previewModel) => {
    if (!previewModel) return null;

    const resumen = {
        vacaciones: 0,
        sustituidos: 0,
        sustituyendo: 0,
        conflictos: 0,
        turnos_vacios: 0
    };

    const employees = previewModel.getEmployees ? previewModel.getEmployees() : [];
    const fechas = Array.isArray(previewModel.dates) ? previewModel.dates : [];

    employees.forEach(employee => {
        fechas.forEach(fecha => {
            const turnoEmpleado = previewModel.getTurnoEmpleado(employee.employee_id, fecha);
            if (!turnoEmpleado) {
                resumen.turnos_vacios++;
                return;
            }
            if (turnoEmpleado.conflicto) {
                resumen.conflictos++;
                return;
            }
            if (turnoEmpleado.incidencia === 'VAC') resumen.vacaciones++;
            if (turnoEmpleado.rol === 'sustituto') resumen.sustituyendo++;
            if (turnoEmpleado.cubierto_por) resumen.sustituidos++;
            if (!turnoEmpleado.turno && !turnoEmpleado.incidencia) resumen.turnos_vacios++;
        });
    });

    console.info('VALIDACION_PREVIEW:', previewModel.hotel, resumen);
    return resumen;
};

window.getTurnoEmpleadoLabel = (turnoEmpleado) => {
    if (!turnoEmpleado) return '—';
    if (turnoEmpleado.conflicto) return 'Conflicto';
    if (turnoEmpleado.incidencia === 'VAC') return 'Vacaciones';
    if (turnoEmpleado.incidencia === 'BAJA') return 'Baja';
    if (turnoEmpleado.incidencia === 'PERM') return 'Permiso';

    const key = window.TurnosRules?.shiftKey(turnoEmpleado.turno || '', 'NORMAL') || '';
    return window.TurnosRules?.definitions?.[key]?.label || turnoEmpleado.turno || '—';
};

window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => `
    <div style="display:flex; flex-direction:column; gap:4px;">
        <span style="font-weight:800; color:#0f172a; font-size:0.82rem;">${escapeHtml(employee?.displayName || employee?.employee_id || 'Empleado')}${showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : ''}</span>
    </div>
`;

window.renderEmpleadoCell = (turnoEmpleado) => {
    const data = turnoEmpleado;
    const turnoBase = data?.turno_base ?? data?._celda?.turno_base ?? '';
    const turnoFinal = data?.turno ?? '';
    const hasSustitucion = Boolean(data?.real && data?.titular && data.real !== data.titular);
    const normalizeTurnoCode = (value) => window.normalizePreviewTurno
        ? window.normalizePreviewTurno(value || '')
        : String(value || '').trim().toUpperCase();
    const internalShiftCodes = new Set([
        'CT',
        'CAMBIO',
        'CAMBIO_TURNO',
        'INTERCAMBIO',
        'INTERCAMBIO_TURNO',
        'INTERCAMBIO_HOTEL',
        'CAMBIO_HOTEL',
        'CAMBIO_POSICION',
        'INTERCAMBIO_POSICION'
    ]);
    const isStateChange = (state) => {
        const reason = String(state?.sourceReason || '').toUpperCase();
        return Boolean(
            state
            && !state.isAbsence
            && (
                state.isModified
                || reason.includes('CAMBIO')
                || reason.includes('INTERCAMBIO')
                || reason.includes('OVERRIDE')
                || reason.includes('REFUERZO')
            )
        );
    };
    const stateToVisibleTurno = (state) => {
        if (!state || state.isAbsence) return '';
        const turno = normalizeTurnoCode(state.turnoFinal);
        if (turno && !internalShiftCodes.has(turno)) return turno;
        if (String(state.estadoFinal || '').toUpperCase() === 'DESCANSO') return 'D';
        return '';
    };

    const normalizarTurnoVisible = (cellData) => {
        if (!cellData) return '';

        if (cellData.incidencia === 'VAC') return 'VAC';
        if (cellData.incidencia === 'BAJA') return 'BAJA';
        if (cellData.incidencia === 'PERM') return 'PERM';

        const candidateStates = [
            cellData._celda?._realState,
            cellData._celda?._finalState,
            cellData._celda?._titularState
        ];

        for (const state of candidateStates) {
            if (!isStateChange(state)) continue;
            const resolvedTurno = stateToVisibleTurno(state);
            if (resolvedTurno) return resolvedTurno;
        }

        const rawTurno = normalizeTurnoCode(cellData.turno);
        if (rawTurno && !internalShiftCodes.has(rawTurno)) return rawTurno;

        const fallbackTurnos = [
            stateToVisibleTurno(cellData._celda?._realState),
            stateToVisibleTurno(cellData._celda?._finalState),
            stateToVisibleTurno(cellData._celda?._titularState),
            cellData.turno_base,
            cellData._celda?.turno_base
        ];

        for (const candidate of fallbackTurnos) {
            const normalized = normalizeTurnoCode(candidate);
            if (normalized && !internalShiftCodes.has(normalized)) return normalized;
        }

        return '';
    };

    const turnoVisible = normalizarTurnoVisible(data);
    const turnoBaseVisible = normalizeTurnoCode(turnoBase);
    const hayCambio = Boolean(
        turnoVisible
        && turnoBaseVisible
        && !['VAC', 'BAJA', 'PERM'].includes(turnoVisible)
        && turnoVisible !== turnoBaseVisible
    );

    const getTurnoLabel = (turno) => {
        const normalized = normalizeTurnoCode(turno);
        const key = window.TurnosRules?.shiftKey(normalized, 'NORMAL') || '';
        return window.TurnosRules?.definitions?.[key]?.label || normalized || '—';
    };

    const getIncidenciaLabel = (incidencia) => {
        if (incidencia === 'VAC') return 'Vacaciones 🏖️';
        if (incidencia === 'BAJA') return 'Baja';
        if (incidencia === 'PERM') return 'Permiso';
        return incidencia || '';
    };

    const getTurnoDisplayLine = (turno) => {
        const turnoLabel = getTurnoLabel(turno);
        return `${escapeHtml(turnoLabel)}${hayCambio ? ' 🔄' : ''}`;
    };

    const getVisualStyle = () => {
        if (!data) {
            return 'background:#f8fafc; color:#475569; border:1px dashed #cbd5e1;';
        }
        if (data.conflicto) {
            return 'background:#fff7ed; color:#9a3412; border:1px solid #fdba74;';
        }
        if (data.incidencia === 'VAC') {
            return 'background:#e0f2fe; color:#075985; border:1px solid #7dd3fc;';
        }
        if (data.incidencia === 'BAJA') {
            return 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;';
        }
        if (data.incidencia === 'PERM') {
            return 'background:#ffedd5; color:#9a3412; border:1px solid #fdba74;';
        }

        const shiftKey = window.TurnosRules?.shiftKey(turnoVisible || turnoBaseVisible || '', 'NORMAL') || '';
        if (shiftKey === 'm') {
            return 'background:#dcfce7; color:#166534; border:1px solid #86efac;';
        }
        if (shiftKey === 't') {
            return 'background:#fef3c7; color:#92400e; border:1px solid #fcd34d;';
        }
        if (shiftKey === 'n') {
            return 'background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd;';
        }
        if (shiftKey === 'd') {
            return 'background:#e5e7eb; color:#991b1b; border:1px solid #d1d5db;';
        }

        return 'background:#f8fafc; color:#1e293b; border:1px solid #e2e8f0;';
    };

    const buildContainer = (title, lines, extraLine = '') => `
        <div title="${escapeHtml(title)}" style="display:flex; flex-direction:column; gap:6px; min-height:86px; padding:10px 8px; border-radius:12px; background:#ffffff;">
            <div style="display:flex; flex-direction:column; gap:4px; align-items:stretch;">
                ${lines.map(line => `
                    <div style="display:inline-flex; align-items:center; justify-content:center; text-align:center; padding:8px 6px; border-radius:10px; font-size:0.76rem; font-weight:800; ${getVisualStyle()}">
                        ${line}
                    </div>
                `).join('')}
            </div>
            ${extraLine}
        </div>
    `;

    if (!data) {
        return buildContainer('Sin turno', ['&mdash;']);
    }

    if (data.conflicto) {
        return buildContainer(
            'Conflicto: múltiples asignaciones',
            ['&#9888; Conflicto'],
            `<div style="font-size:0.7rem; color:#9a3412; text-align:center;">(múltiples asignaciones)</div>`
        );
    }

    if (data.incidencia === 'VAC') {
        const incidenciaLabel = getIncidenciaLabel(data.incidencia);
        return buildContainer(incidenciaLabel, [escapeHtml(incidenciaLabel)]);
    }

    if (data.incidencia === 'BAJA') {
        const incidenciaLabel = getIncidenciaLabel(data.incidencia);
        return buildContainer(incidenciaLabel, [escapeHtml(incidenciaLabel)]);
    }

    if (data.incidencia === 'PERM') {
        const incidenciaLabel = getIncidenciaLabel(data.incidencia);
        return buildContainer(incidenciaLabel, [escapeHtml(incidenciaLabel)]);
    }

    if (!turnoVisible) {
        return buildContainer('Sin turno', ['&mdash;']);
    }

    if (hasSustitucion) {
        const turnoLabel = getTurnoLabel(turnoVisible);
        const turnoDisplayLine = getTurnoDisplayLine(turnoVisible);
        const details = `(Sustituye a ${escapeHtml(data.titular || '—')})`;
        return buildContainer(turnoLabel, [turnoDisplayLine], `
            <div style="font-size:0.7rem; color:#475569; text-align:center;">${details}</div>
        `);
    }

    const turnoLabel = getTurnoLabel(turnoVisible);
    return buildContainer(turnoLabel, [getTurnoDisplayLine(turnoVisible)]);
};

window.navigatePreview = (dir) => {
    if (window._previewMode === 'weekly' && window._fpWeek) {
        const current = window._fpWeek.selectedDates[0] || new Date();
        current.setDate(current.getDate() + (dir * 7));
        window._fpWeek.setDate(current);
        window.renderPreview();
    } else if (window._previewMode === 'monthly' && window._fpMonth) {
        const current = window._fpMonth.selectedDates[0] || new Date();
        current.setMonth(current.getMonth() + dir);
        window._fpMonth.setDate(current);
        window.renderPreview();
    }
};

window.renderPreview = async () => {
    const area = $('#previewContent');
    if (!area) return;
    
    const hotelSel = $('#prevHotel')?.value || 'all';
    const isWeekly = window._previewMode === 'weekly';
    const rawDate = $('#prevWeekDate')?.value || window.isoDate(new Date());
    const rawMonth = $('#prevMonth')?.value || window.isoDate(new Date()).substring(0,7);

    area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando cuadrantes...</div>`;

    try {
        window._previewPuestosModels = Object.create(null);
        let start, end;
        if (isWeekly) {
            const base = new Date(rawDate + 'T12:00:00');
            start = window.getMonday(base);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
        } else {
            const [y, m] = rawMonth.split('-').map(Number);
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0);
        }

        const startISO = window.isoDate(start);
        const endISO = window.isoDate(end);

        let { rows: data, eventos } = await window.TurnosDB.fetchRangoCalculado(startISO, endISO);
        const hotels = await window.TurnosDB.getHotels();
        const profiles = await window.TurnosDB.getEmpleados();
        const excelSource = await window.loadAdminExcelSourceRows();
        
        const hotelsToRender = hotelSel === 'all' ? hotels : [hotelSel];
        area.innerHTML = '';

        const columns = [];
        let curr = new Date(start);
        while (curr <= end) {
            const iso = window.isoDate(curr);
            columns.push({
                date: iso,
                dayName: ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'][curr.getDay()],
                dayDisplay: window.fmtDateLegacy(iso)
            });
            curr.setDate(curr.getDate() + 1);
        }

        for (const hName of hotelsToRender) {
            const hotelSourceRows = (excelSource[hName] || []).filter(row => {
                if (!row?.weekStart) return false;
                const rowEnd = window.addIsoDays(row.weekStart, 6);
                return row.weekStart <= endISO && rowEnd >= startISO;
            });

            const previewModel = window.createPuestosPreviewModel({
                hotel: hName,
                dates: columns.map(c => c.date),
                sourceRows: hotelSourceRows,
                rows: data,
                eventos,
                employees: profiles
            });

            previewModel.puestos.forEach(puesto => {
                window._previewPuestosModels[puesto.puesto_id] = previewModel;
            });
            window.detectarErrores(previewModel);
            window.validarPreviewModel(previewModel);

            if (previewModel.puestos.length === 0) continue;
            const employeesToRender = previewModel.getEmpleadosVisibles
                ? previewModel.getEmpleadosVisibles(startISO, endISO)
                : previewModel.getEmployees();
            const orderedEmployeesToRender = previewModel.ordenarEmpleados
                ? previewModel.ordenarEmpleados(employeesToRender, columns.map(c => c.date))
                : employeesToRender;
            if (!orderedEmployeesToRender.length) continue;
            const renderEmployeeTable = true;

            if (renderEmployeeTable) {
                const hotelSection = document.createElement('div');
                hotelSection.innerHTML = `
                <div class="glass-panel" style="margin-bottom:3rem; padding:0; overflow:hidden; border:1px solid #e2e8f0; background:white; border-radius:16px;">
                    <div style="padding:18px 25px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:15px; background:#f8fafc;">
                        <img src="${hName.toLowerCase().includes('guadiana') ? 'guadiana logo.jpg' : 'cumbria logo.jpg'}" style="width:38px; height:38px; object-fit:contain;">
                        <h2 style="margin:0; font-size:1.1rem; color:#1e293b; font-weight:800;">${hName} <span style="color:#94a3b8; font-size:0.85rem;">${isWeekly ? `Semana ${window.fmtDateLegacy(startISO)}` : `${window.fmtDateLegacy(startISO)} - ${window.fmtDateLegacy(endISO)}`}</span></h2>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="preview-table-premium" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:15px 25px; text-align:left; border-bottom:1px solid #f1f5f9; width:220px; color:#64748b; font-size:0.7rem; text-transform:uppercase; position:sticky; left:0; background:#f8fafc; z-index:10;">Empleado</th>
                                    ${columns.map(c => `<th style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:145px; border-left:1px solid #f1f5f9;"><div style="font-size:0.65rem; color:#94a3b8;">${c.dayName}</div><div style="font-size:0.75rem; font-weight:600;">${c.dayDisplay.toLowerCase()}</div></th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${orderedEmployeesToRender.map(employee => `
                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:12px 25px; background:white; position:sticky; left:0; z-index:5; border-right:1px solid #f1f5f9;">
                                            ${window.renderEmpleadoRowHeader(employee, { showVacationIcon: true })}
                                        </td>
                                        ${columns.map(c => `<td style="padding:8px; text-align:center; border-left:1px solid #f1f5f9;">${window.renderEmpleadoCell(previewModel.getTurnoEmpleado(employee.employee_id, c.date))}</td>`).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
                area.appendChild(hotelSection);
            } else {
                // Monthly Calendar logic (Engine V3 enabled)
                const hotelSection = document.createElement('div');
                hotelSection.className = 'hotel-calendar-view';
                hotelSection.style.marginBottom = '2.5rem';

                const rosterDates = columns.map(c => c.date);
                const rosterGrid = window.TurnosEngine.buildRosterGrid({
                    rows: data,
                    events: eventos,
                    employees: profiles,
                    dates: rosterDates,
                    hotel: hName,
                    sourceRows: [] // El mensual no suele tener orden de Excel, pero se podría cargar
                });

                const firstDay = new Date(columns[0].date + 'T12:00:00');
                const startDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); 
                const cells = [];
                for (let i = 1; i < startDow; i++) cells.push('<div class="cal2-cell cal2-empty"></div>');

                rosterDates.forEach((dateKey) => {
                    const groups = { M: [], T: [], N: [], D: [], ABS: [] };
                    
                    previewModel.puestos.forEach(puesto => {
                        const celda = previewModel.getCelda(puesto.puesto_id, dateKey);
                        const shiftKey = window.TurnosRules?.shiftKey(celda.turno || celda.turno_base, 'NORMAL') || '';
                        const displayName = String(celda.real || celda.titular || puesto.excelLabel || puesto.label).split(' ')[0];
                        const title = `${puesto.label} · ${celda.titular || 'Sin titular'}${celda.real && celda.real !== celda.titular ? ` -> ${celda.real}` : ''}`;

                        if (celda.incidencia) {
                            const absClass = celda.incidencia === 'VAC' ? 'vac' : (celda.incidencia === 'BAJA' ? 'b' : 'p');
                            const absIcon = celda.incidencia === 'VAC' ? 'V' : (celda.incidencia === 'BAJA' ? 'B' : 'P');
                            groups.ABS.push({
                                name: String(celda.titular || puesto.excelLabel || puesto.label).split(' ')[0],
                                icon: absIcon,
                                cls: absClass,
                                title
                            });
                        }

                        if (shiftKey === 'm') groups.M.push({ name: displayName, title, icon: '' });
                        else if (shiftKey === 't') groups.T.push({ name: displayName, title, icon: '' });
                        else if (shiftKey === 'n') groups.N.push({ name: displayName, title, icon: '' });
                        else if (shiftKey === 'd') groups.D.push({ name: displayName, title, icon: '' });
                    });

                    const badge = (list, cls, defaultIcon) => {
                        if (!list.length) return '';
                        const names = list.map(item => `<span title="${escapeHtml(item.title || '')}">${escapeHtml(item.name)}${item.icon === '🔄' ? '🔄' : ''}</span>`).join(' · ');
                        return `<div class="cal2-group cal2-${cls}"><span class="cal2-icon">${defaultIcon}</span><span class="cal2-names">${names}</span></div>`;
                    };

                    cells.push(`<div class="cal2-cell">
                        <div class="cal2-daynum">${new Date(dateKey + 'T12:00:00').getDate()}</div>
                        <div class="cal2-content">
                            ${badge(groups.M,'m','☀️')}
                            ${badge(groups.T,'t','🌤️')}
                            ${badge(groups.N,'n','🌙')}
                            ${badge(groups.D,'d','😴')}
                            ${groups.ABS.map(a => `<div class="cal2-group cal2-${a.cls}" title="${escapeHtml(a.title || '')}"><span class="cal2-icon">${a.icon}</span><span class="cal2-names">${a.name}</span></div>`).join('')}
                        </div>
                    </div>`);
                });

                const lastDate = new Date(rosterDates[rosterDates.length - 1] + 'T12:00:00');
                const endDow = lastDate.getDay() || 7;
                for (let i = endDow; i < 7; i++) cells.push('<div class="cal2-cell cal2-empty"></div>');

                hotelSection.innerHTML = `<div style="background:white; border-radius:18px; overflow:hidden; border:1px solid #e8ecf0;">
                    <div style="padding:15px 20px; background:#f8fafc; border-bottom:1px solid #e4e9f0; font-weight:800; display:flex; justify-content:space-between; align-items:center;">
                        <span>${hName}</span>
                        <span style="font-size:0.75rem; color:#94a3b8; font-weight:400;">Resolución Motor V3</span>
                    </div>
                    <div class="cal2-header"><div>LUN</div><div>MAR</div><div>MIÉ</div><div>JUE</div><div>VIE</div><div>SÁB</div><div>DOM</div></div>
                    <div class="cal2-grid">${cells.join('')}</div>
                </div>`;
                area.appendChild(hotelSection);
            }
        }
    } catch (err) {
        area.innerHTML = `<div style="padding:2rem; color:red;">Error: ${err.message}</div>`;
    }
};

// ==========================================
// 4. EDITOR MODAL
// ==========================================
window.abrirEditorRapido = (empleadoId, fecha, cellEl) => {
    let modal = document.getElementById('quickEditModal');
    if(modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'quickEditModal';
    modal.style = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--surface); padding:25px; border-radius:15px; box-shadow:0 10px 50px rgba(0,0,0,0.6); z-index:9999; border:1px solid var(--border); min-width:300px;`;
    modal.innerHTML = `
        <h3 style="margin:0 0 10px 0; text-align:center;">Editar turno</h3>
        <p style="margin:0 0 15px 0; text-align:center; color:var(--text-dim);"><b>${empleadoId}</b> &bull; ${fecha}</p>
        <input type="text" id="quickTurno" placeholder="Ej: M, T, N" class="search-input" style="text-align:center; margin-bottom:15px; font-size:1.2rem; font-weight:bold;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button class="btn" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','VAC')">VAC</button>
            <button class="btn" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','BAJA')">BAJA</button>
            <button class="btn" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','PERM')">PERM</button>
            <button class="btn" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','CT')">CT</button>
            <button class="btn active" style="grid-column: span 2; background:var(--accent); color:white;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','NORMAL')">Guardar</button>
        </div>
        <button class="btn" style="background:transparent; color:var(--text-dim); margin-top:10px; width:100%;" onclick="document.getElementById('quickEditModal').remove()">Cancelar</button>
    `;
    document.body.appendChild(modal);
    document.getElementById('quickTurno').focus();
};

window.seleccionarTipo = async (empleadoId, fecha, tipo) => {
    const turno = document.getElementById('quickTurno').value;
    const hotel = $('#prevHotel')?.value || 'DEFAULT';
    try {
        await window.TurnosDB.upsertTurno(empleadoId, fecha, turno, tipo, hotel);
        document.getElementById('quickEditModal').remove();
        window.renderPreview();
    } catch (e) { alert(e.message); }
};

// ==========================================
// 5. BOOTSTRAP
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    window._fpWeek = flatpickr("#prevWeekDate", { dateFormat: "Y-m-d", defaultDate: "today", locale: "es", onChange: () => window.renderPreview() });
    window._fpMonth = flatpickr("#prevMonth", { dateFormat: "Y-m", defaultDate: new Date(), locale: "es", plugins: [new monthSelectPlugin({ shorthand: true, dateFormat: "Y-m" })], onChange: () => window.renderPreview() });
    const hotels = await window.TurnosDB.getHotels();
    const sel = $('#prevHotel');
    if (sel) sel.innerHTML = `<option value="all">TODOS LOS HOTELES</option>` + hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    const excelSel = $('#excelHotel');
    if (excelSel) excelSel.innerHTML = `<option value="all">Filtro por Hotel: Ver Todos</option>` + hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    const excelMonth = $('#excelMonth');
    if (excelMonth && !excelMonth.value) excelMonth.value = window.isoDate(new Date()).slice(0, 7);
    window.renderPreview();

    // Cargar empleados inicialmente
    if (window.populateEmployees) window.populateEmployees();

    // Opcional: recargar empleados al hacer click en el menú "Empleados"
    document.querySelectorAll('.menu a').forEach(a => {
        a.addEventListener('click', (e) => {
            if (a.getAttribute('href') === '#section-employees') {
                if (window.populateEmployees) window.populateEmployees();
            }
        });
    });
});

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function fmtDateLegacy(date) {
    if (!date) return '-';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}
window.fmtDateLegacy = fmtDateLegacy;

// ==========================================
// 6. GESTIÓN DE EMPLEADOS Y PERSONAL (RESTORED)
// ==========================================
window.populateEmployees = async () => {
    const area = $('#employeesContent'); if (!area) return;
    area.innerHTML = '<div style="padding:4rem; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando empleados...</div>';
    
    try {
        // Rango de 30 días para estadísticas
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        const startISO = window.isoDate(start) || start.toISOString().split('T')[0];
        const endISO = window.isoDate(end) || end.toISOString().split('T')[0];

        const { rows, eventos } = await window.TurnosDB.fetchRangoCalculado(startISO, endISO);
        const profilesResult = await window.TurnosDB.getEmpleados();
        const profiles = {};
        profilesResult.forEach(p => profiles[p.id || p.nombre] = p);
        
        const excelSource = await window.loadAdminExcelSourceRows();
        
        // Generar lista de fechas
        const dates = [];
        let curr = new Date(start);
        while (curr <= end) {
            dates.push(window.isoDate(curr) || curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
        }

        const stats = {};
        const getStat = (empName, hotelName) => {
            if (!stats[empName]) {
                stats[empName] = { 
                    emp: empName,
                    hotel: hotelName || 'Sin Hotel',
                    m: 0, t: 0, n: 0, v: 0, d: 0, b: 0, x: 0,
                    history: []
                };
            }
            return stats[empName];
        };

        const hotelsList = await window.TurnosDB.getHotels();
        
        // Iterar el motor por cada hotel y cada día para extraer el Roster final operativo
        hotelsList.forEach(hName => {
            dates.forEach(date => {
                const hotelExcelRows = excelSource[hName] || [];
                const weekSeed = hotelExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));
                if (!weekSeed) return;

                // Lunes correspondiente a este día
                const weekStartIso = weekSeed.weekStart;
                const fechasSemana = window.getFechasSemana(weekStartIso);
                const sourceIndex = Math.max(0, fechasSemana.indexOf(date));

                const weekExcelRows = hotelExcelRows.filter(r => r.weekStart === weekStartIso);
                if (weekExcelRows.length === 0) return; // Si no hay excel para esa semana, saltamos
                
                const dayRoster = window.TurnosEngine.buildDayRoster({
                    rows,
                    events: eventos,
                    employees: profilesResult,
                    date: date,
                    hotel: hName,
                    sourceRows: weekExcelRows,
                    sourceIndex: sourceIndex
                });

                dayRoster.forEach(entry => {
                    const cell = entry.cell || {};
                    // entry.displayAs trae el nombre normalizado pero visualmente correcto
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    
                    let label = cell.turno || '—';
                    if (cell.tipo && cell.tipo !== 'NORMAL' && cell.tipo !== 'CT') label = cell.tipo;
                    
                    const cls = window.TurnosRules ? window.TurnosRules.shiftKey(label, cell.tipo) : '';
                    if (['m', 't', 'n', 'v', 'd', 'b'].includes(cls)) s[cls]++;
                    else s.x++;

                    s.history.push({
                        fecha: date,
                        turno: label,
                        cls: cls,
                        original: cell.turno || ''
                    });
                });
            });
        });

        // Ordenar historial por fecha descendente
        Object.values(stats).forEach(s => {
            s.history.sort((a,b) => b.fecha.localeCompare(a.fecha));
        });

        const hotels = [...new Set(Object.values(stats).map(s => s.hotel))].sort();
        if (hotels.length === 0) {
            area.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;">No hay datos de empleados en los últimos 30 días.</div>';
            return;
        }

        area.innerHTML = hotels.map(hotel => {
            const emps = Object.values(stats).filter(s => s.hotel === hotel).sort((a, b) => a.emp.localeCompare(b.emp));
            const cards = emps.map(s => {
                const empName = s.emp;
                const p = profiles[empName] || {};
                const initials = empName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const totalWork = s.m + s.t + s.n;
                const hue = Math.abs(empName.length * 137.5) % 360; 
                
                return `
                <div class="emp-card-premium" onclick="window.openEmpDrawer('${empName.replace(/'/g, "\\'")}')">
                    <div class="ep-gradient" style="background: linear-gradient(135deg, hsl(${hue}, 70%, 65%), hsl(${hue}, 70%, 45%))"></div>
                    <div class="ep-body">
                        <div class="ep-avatar-wrap">
                            <div class="ep-avatar" style="background: hsl(${hue}, 70%, 95%); color: hsl(${hue}, 70%, 30%)">${initials}</div>
                        </div>
                        <div class="ep-info">
                            <h3 class="ep-name">${empName}</h3>
                            <p class="ep-role">${p.puesto || 'Cargando...'}</p>
                        </div>
                        <div class="ep-stats">
                            <div class="ep-stat"><span class="ep-label">M</span><span class="ep-val">${s.m}</span></div>
                            <div class="ep-stat"><span class="ep-label">T</span><span class="ep-val">${s.t}</span></div>
                            <div class="ep-stat"><span class="ep-label">N</span><span class="ep-val">${s.n}</span></div>
                            <div class="ep-stat highlight"><span class="ep-label">V</span><span class="ep-val">${s.v}</span></div>
                        </div>
                        <div class="ep-footer">
                             <div class="ep-progress-label">Actividad 30 días</div>
                             <div class="ep-progress-bar"><div class="ep-progress-fill" style="width:${Math.min(100, (totalWork/30)*100)}%; background:hsl(${hue}, 70%, 50%)"></div></div>
                             <div class="ep-total">${totalWork} turnos totales</div>
                        </div>
                    </div>
                </div>`;
            }).join('');
            return `<div class="emp-hotel-section">
                <div class="section-title-premium">
                    <span class="stp-icon">🏨</span>
                    <h2>${hotel}</h2>
                    <span class="stp-count">${emps.length} empleados activos</span>
                </div>
                <div class="employees-grid-inner">${cards}</div>
            </div>`;
        }).join('');
        
        window._lastStats = stats;
    } catch (e) {
        area.innerHTML = `<div style="color:red; padding:2rem;">Error cargando empleados: ${e.message}</div>`;
        console.error(e);
    }
};

window.openEmpDrawer = (name) => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    if (!drawer || !body) return;
    
    drawer.classList.add('open');
    const s = (window._lastStats && window._lastStats[name]) || { m:0, t:0, n:0, v:0, b:0, d:0, hotel: 'N/A', history: [] };
    
    const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    const totalWorking = s.m + s.t + s.n;

    body.innerHTML = `
        <div class="drawer-header">
            <div class="emp-avatar large" style="--emp-hue:${Math.abs(name.length * 17) % 360}">${initials}</div>
            <div class="drawer-title-group">
                <h2 style="margin:0; font-size:1.6rem; letter-spacing:-0.02em;">${name}</h2>
                <div style="display:flex; gap:6px; margin-top:4px;">
                    <span class="status-badge" style="background:var(--accent-dim); color:var(--accent); border:none; font-size:0.7rem;">${s.hotel}</span>
                    <span class="status-badge" style="background:var(--success-dim); color:var(--success); border:none; font-size:0.7rem;">Resumen 30 Días</span>
                </div>
            </div>
        </div>
        
        <div class="drawer-section-title">RESUMEN DE ACTIVIDAD RECIENTE</div>
        <div class="drawer-stats-grid-premium">
            <div class="stat-premium">
                <span class="sp-label">Mañanas</span>
                <span class="sp-value color-m">${s.m}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-m" style="width:${Math.min(100, (s.m/30)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Tardes</span>
                <span class="sp-value color-t">${s.t}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-t" style="width:${Math.min(100, (s.t/30)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Noches</span>
                <span class="sp-value color-n">${s.n}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-n" style="width:${Math.min(100, (s.n/30)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Vacaciones</span>
                <span class="sp-value color-v">${s.v}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-v" style="width:${Math.min(100, (s.v/30)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Bajas</span>
                <span class="sp-value color-b">${s.b}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-b" style="width:${Math.min(100, (s.b/10)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Descansos</span>
                <span class="sp-value color-d">${s.d}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-d" style="width:${Math.min(100, (s.d/30)*100)}%"></div></div>
            </div>
        </div>

        <div class="drawer-section-title" style="margin-top:2rem;">HISTORIAL DE TURNOS</div>
        <div class="history-list">
            ${s.history.slice(0, 15).map(h => `
                <div class="history-item">
                    <div class="hi-date">
                        <span class="hi-day">${new Date(h.fecha).toLocaleDateString('es-ES', {day:'2-digit'})}</span>
                        <span class="hi-month">${new Date(h.fecha).toLocaleDateString('es-ES', {month:'short'}).replace('.','').toUpperCase()}</span>
                    </div>
                    <div class="hi-info">
                        <div class="sc-label">${h.turno}</div>
                    </div>
                    <div class="hi-type"><span class="turno-pill turno-${h.cls}" style="padding:2px 6px; font-size:9px;">${h.cls.toUpperCase()}</span></div>
                </div>
            `).join('')}
            ${s.history.length === 0 ? '<div style="padding:2rem; text-align:center; opacity:0.3; font-size:0.8rem;">No hay historial disponible</div>' : ''}
        </div>
    `;
};

window.closeEmpDrawer = () => { if($('#empDrawer')) $('#empDrawer').classList.remove('open'); };
