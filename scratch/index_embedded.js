
    let _picker;
    let _publicRealtimeChannel = null;
    let _publicRefreshTimer = null;
    const $ = s => document.querySelector(s);
    const escapeHtml = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ── Auto-refresh configuración ────────────────────────────────────────────
    // Auto-refresh público cada 15 minutos para evitar interrupciones de lectura.
    const PUBLIC_AUTO_REFRESH_MS = window.__DEBUG_REFRESH_MS || (15 * 60 * 1000);
    const USER_IDLE_THRESHOLD_MS = 60 * 1000; // No refrescar si el usuario estuvo activo en el último minuto
    let _lastUserInteractionAt = Date.now();
    let _publicPeriodicTimer = null;
    // ─────────────────────────────────────────────────────────────────────────
    const formatDisplayName = (name) => {
        if (!name) return '';
        return name.replace(/_DUP_.*$/, '').replace(/_CT$/, '').replace(/_/g, ' ').trim();
    };
    const monthNamesFull = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

    const formatDateLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isNightCode = (value) => String(value || '').toUpperCase().startsWith('N');

    function accumulateNightSummary(summaryByMonth, hotelName, employeeName, fecha) {
        const dt = new Date(`${fecha}T12:00:00`);
        const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        if (!summaryByMonth.has(monthKey)) summaryByMonth.set(monthKey, new Map());
        const hotels = summaryByMonth.get(monthKey);
        if (!hotels.has(hotelName)) hotels.set(hotelName, new Map());
        const employees = hotels.get(hotelName);
        employees.set(employeeName, (employees.get(employeeName) || 0) + 1);
    }

    function getSelectedDaysInMonth(year, month, rangeStart, rangeEnd) {
        const monthStart = new Date(year, month - 1, 1, 12);
        const monthEnd = new Date(year, month, 0, 12);
        const selectedStart = new Date(`${rangeStart}T12:00:00`);
        const selectedEnd = new Date(`${rangeEnd}T12:00:00`);
        const start = selectedStart > monthStart ? selectedStart : monthStart;
        const end = selectedEnd < monthEnd ? selectedEnd : monthEnd;
        if (end < start) return 0;
        return Math.round((end - start) / 86400000) + 1;
    }

    function renderNightSummary(container, summaryByMonth, hasRows, rangeStart, rangeEnd) {
        const section = document.createElement('section');
        section.className = 'night-summary';

        if (!hasRows || !summaryByMonth.size) {
            section.innerHTML = `
                <h2 class="night-summary-title">Resumen de noches</h2>
                <div class="night-empty">No hay noches en el periodo seleccionado.</div>
            `;
            container.appendChild(section);
            return;
        }

        let html = '<h2 class="night-summary-title">Resumen de noches</h2>';
        [...summaryByMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([monthKey, hotels]) => {
            const [year, month] = monthKey.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const selectedDays = getSelectedDaysInMonth(year, month, rangeStart, rangeEnd);
            html += `<div class="night-month"><h3>${monthNamesFull[month - 1]} de ${year}<span class="night-month-days">(${selectedDays} de ${daysInMonth} días)</span></h3><div class="night-hotel-grid">`;

            [...hotels.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).forEach(([hotelName, employees]) => {
                const rows = [...employees.entries()]
                    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
                    .map(([employeeName, total]) => `
                        <tr>
                            <td>${escapeHtml(employeeName)}</td>
                            <td>${total}</td>
                        </tr>
                    `).join('');

                html += `
                    <div class="night-hotel">
                        <table class="night-table">
                            <thead>
                                <tr>
                                    <th>${escapeHtml(hotelName)}</th>
                                    <th>Noches</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
            });

            html += '</div></div>';
        });

        section.innerHTML = html;
        container.appendChild(section);
    }

    function applyTheme(theme) {
        document.body.classList.toggle('night-mode', theme === 'night');
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
        localStorage.setItem('public-theme', theme);
    }

    window.setVisualTheme = (theme) => applyTheme(theme);

    // Captura el estado actual de navegación para preservarlo tras un refresco silencioso
    function _capturePublicState() {
        return {
            scrollY: window.scrollY,
            mainScrollTop: document.querySelector('.public-main')?.scrollTop || 0,
            hotel: $('#hotelSelect')?.value || '',
            weekStart: _picker?.selectedDates?.[0] ? formatDateLocal(_picker.selectedDates[0]) : '',
            theme: localStorage.getItem('public-theme') || 'day'
        };
    }

    // Restaura el estado capturado después de un refresco silencioso
    function _restorePublicState(state) {
        if (!state) return;
        // Restaurar hotel
        const sel = $('#hotelSelect');
        if (sel && state.hotel !== undefined && sel.value !== state.hotel) {
            sel.value = state.hotel;
        }
        // Restaurar semana (solo si no la cambió el usuario)
        if (state.weekStart && _picker) {
            const current = _picker.selectedDates?.[0] ? formatDateLocal(_picker.selectedDates[0]) : '';
            if (current !== state.weekStart) {
                const d = new Date(state.weekStart + 'T12:00:00');
                setWeekRange(d);
            }
        }
        // Restaurar scroll después de que el DOM se actualice
        requestAnimationFrame(() => {
            window.scrollTo({ top: state.scrollY, behavior: 'instant' });
            const main = document.querySelector('.public-main');
            if (main && state.mainScrollTop) main.scrollTop = state.mainScrollTop;
        });
    }

    window.renderPublicView = async (opts = {}) => {
        const hotel = $('#hotelSelect').value;
        const range = _picker.selectedDates;
        if (range.length < 2) return;
        const start = formatDateLocal(range[0]);
        const end = formatDateLocal(range[1]);

        const container = $('#publicContainer');
        // Anti-parpadeo: solo mostrar spinner en el primer render (container vacío)
        const isFirstRender = !container.hasChildNodes() || container.dataset.loaded !== '1';
        if (isFirstRender) {
            container.innerHTML = '<div style="padding:100px; text-align:center; font-weight:700; color:#5f6f84;">Cargando cuadrante...</div>';
        }

        const [snapsResult, empleadosResult] = await Promise.all([
            window.TurnosDB.client
                .from('publicaciones_cuadrante')
                .select('*')
                .eq('estado', 'activo')
                .gte('semana_inicio', start)
                .lte('semana_inicio', end)
                .order('semana_inicio', { ascending: true })
                .order('hotel', { ascending: true })
                .order('version', { ascending: false }),
            window.TurnosDB.getEmpleados()
        ]);
        const snaps = snapsResult.data;
        // Índice de nombres reales por ID para reconciliación rápida
        window._publicProfilesIndex = {};
        (empleadosResult || []).forEach(e => {
            if (e.id && e.nombre) window._publicProfilesIndex[String(e.id).trim()] = e.nombre;
            if (e.nombre) window._publicProfilesIndex[String(e.nombre).trim()] = e.nombre;
        });

        if (!snaps || snaps.length === 0) {
            container.innerHTML = '<div style="padding:100px; text-align:center; font-weight:700; color:#5f6f84;">No hay cuadrantes publicados desde esta fecha.</div>';
            return;
        }

        container.innerHTML = '';
        container.dataset.loaded = '1';
        
        console.log("[INDEX] weekStart", start);
        console.log("[INDEX] publicaciones recibidas", snaps.length);

        const seen = new Set();
        const selectedByHotel = [];
        snaps.forEach(s => {
            const key = `${s.hotel}_${s.semana_inicio}`;
            if (seen.has(key)) return;
            if (hotel && s.hotel !== hotel) return;
            if (s.hotel.toUpperCase().startsWith('TEST')) return; 
            seen.add(key);
            selectedByHotel.push(s);
        });

        console.log("[INDEX] seleccionadas", selectedByHotel.map(p => ({
            hotel: p.hotel,
            version: p.version,
            estado: p.estado,
            semana_inicio: p.semana_inicio,
            rows: (p.snapshot_json?.rows || p.snapshot_json?.empleados)?.length
        })));

        if (selectedByHotel.length > 0) {
            const firstRow = (selectedByHotel[0].snapshot_json?.rows || selectedByHotel[0].snapshot_json?.empleados)?.[0];
            const cells = firstRow?.turnosOperativos || firstRow?.cells || firstRow?.dias || {};
            console.log("[INDEX] first row", firstRow);
            console.log("[INDEX] first cell keys", Object.keys(cells));
        }

        container.innerHTML = '';
        container.dataset.loaded = '1';
        
        const summaryByMonth = new Map();
        let hasRows = false;
        selectedByHotel.forEach(s => {
            hasRows = true;
            renderHotelSection(container, s, start, end, summaryByMonth);
        });
        renderNightSummary(container, summaryByMonth, hasRows, start, end);
        applyTheme(localStorage.getItem('public-theme') || 'day');
        _lastPublicRenderTime = Date.now();
        // Si fue un refresco silencioso, restaurar posición de scroll
        if (opts._savedState) {
            _restorePublicState(opts._savedState);
        }
    };

    function renderHotelSection(container, snap, rangeStart, rangeEnd, summaryByMonth) {
        const div = document.createElement('div');
        div.className = 'hotel-card';
        const logoUrl = snap.hotel.includes('Sercotel') ? 'guadiana logo.jpg' : 'cumbria logo.jpg';
        const formattedWeek = snap.semana_inicio.split('-').reverse().join('/');

        div.innerHTML = `
            <div class="hotel-header">
                <div class="hotel-heading">
                    <div class="hotel-logo"><img src="${logoUrl}"></div>
                    <div class="hotel-info">
                        <h2>${snap.hotel}</h2>
                        <div class="week-label">SEMANA DEL ${formattedWeek}</div>
                    </div>
                </div>
                <div class="header-mode">
                    <button type="button" class="mode-btn" data-theme="day" onclick="setVisualTheme('day')">Día</button>
                    <button type="button" class="mode-btn" data-theme="night" onclick="setVisualTheme('night')">Noche</button>
                </div>
            </div>
            <div class="viewport"></div>
        `;
        container.appendChild(div);
        
        const viewport = div.querySelector('.viewport');
        const rows = snap.snapshot_json.rows || snap.snapshot_json.empleados || [];
        
        const dates = [];
        let d = new Date(snap.semana_inicio + 'T12:00:00');
        for(let i=0; i<7; i++){
            dates.push(formatDateLocal(d));
            d.setDate(d.getDate()+1);
        }

        const days = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
        const todayKey = formatDateLocal(new Date());
        const columns = dates.map((f, idx) => {
            const dt = new Date(f + 'T12:00:00');
            return {
                title: days[dt.getDay()],
                subtitle: `${dt.getDate()}/${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][dt.getMonth()]}/${String(dt.getFullYear()).slice(-2)}`,
                dbFecha: f,
                width: 140,
                isWeekend: dt.getDay() === 0 || dt.getDay() === 6,
                isToday: f === todayKey
            };
        });

        const table = new window.VirtualTable(viewport, { columns, rowHeight: 62 });

        table.renderCellContent = function(cell, data, empName, fecha) {
            if (!data || data.code === '—' || data.code === '') {
                return cell.innerHTML = '<span class="empty-dash">—</span>';
            }
            const display = window.TurnosRules.getPublicCellDisplay(data, { compact: false });
            const cls = window.TurnosRules.shiftKey(data.code, data.type);
            
            cell.innerHTML = '';
            const pill = document.createElement('div');
            pill.className = `turno-pill v-${cls}`;
            pill.textContent = display.label;
            if (cls === 'v' || cls === 'vac') {
                pill.innerHTML += ' <span class="icon-vac">\u{1F3D6}\u{FE0F}</span>';
            }
            
            if (cls === 'n' || cls === 'noche') {
                pill.innerHTML += ' <span class="icon-moon">\u{1F319}</span>';
            }
            
            if (display.icons) {
                display.icons.forEach(icon => {
                    if (icon === '\u{1F504}' || icon === '🔄') {
                        pill.innerHTML += ' <span class="icon-sync">\u{1F504}</span>';
                    } else if (icon === '\u{1F4CC}' || icon === '📌') {
                        pill.innerHTML += ' <span class="icon-pin">\u{1F4CC}</span>';
                    }
                });
            }
            cell.appendChild(pill);
        };

        table.renderRow = function(tr, rowData) {
            const tds = tr.children;
            const daysMap = rowData.turnosOperativos || rowData.cells || rowData.dias || {};
            // Bug-fix: apoyo/ocasional employees must not show structural counters
            const skipCounters = !!(
                rowData.excludeCounters === true ||
                String(rowData.tipoPersonal || rowData.tipo_personal || rowData.tipo || '').toLowerCase().includes('apoyo') ||
                String(rowData.tipoPersonal || rowData.tipo_personal || rowData.tipo || '').toLowerCase().includes('ocasional')
            );
            let nights = 0, rests = 0;
            if (!skipCounters) {
                dates.forEach(f => {
                    const d = daysMap[f] || {};
                    const c = (d.code || '').toUpperCase();
                    if (c.startsWith('N')) nights++;
                    if (c === 'D' || c === 'DESCANSO') rests++;
                });
            }

            const isAbsent = rowData.rowType === 'ausencia_informativa' || rowData.rowType === 'ausente_info';
            const profilesIdx = window._publicProfilesIndex || {};
            const empId = String(rowData.empleado_id || rowData.nombre || '').trim();
            const resolvedName = profilesIdx[empId] || rowData.nombreVisible || rowData.nombre || 'Empleado';
            const displayName = formatDisplayName(resolvedName);

            tds[0].innerHTML = `
                <div class="emp-cell ${isAbsent ? 'ausencia-row' : ''}">
                    <div class="employee-head">
                        <div class="employee-name">${escapeHtml(displayName)}</div>
                    ${isAbsent || skipCounters ? '' : `
                    <div class="emp-badges">
                        <span class="badge"><span class="badge-icon">🌙</span> ${nights}</span>
                        <span class="badge">D ${rests}</span>
                    </div>
                    `}
                    </div>
                </div>
            `;

            dates.forEach((f, i) => {
                table.renderCellContent(tds[i+1], daysMap[f], rowData.nombre, f);
            });
        };

        const filteredRows = rows.filter(r => !String(r.nombreVisible || r.nombre || "").includes("_DUP_") && !String(r.empleado_id || "").includes("_DUP_"));
        const sorted = window.TurnosRules.sortEmployees(filteredRows);

        sorted.forEach(rowData => {
            const skipCounters = !!(
                rowData.excludeCounters === true ||
                String(rowData.tipoPersonal || rowData.tipo_personal || rowData.tipo || '').toLowerCase().includes('apoyo') ||
                String(rowData.tipoPersonal || rowData.tipo_personal || rowData.tipo || '').toLowerCase().includes('ocasional')
            );
            if (skipCounters) return;
            const daysMap = rowData.dias || rowData.cells || {};
            dates.forEach(f => {
                const dayData = daysMap[f] || {};
                const code = String(dayData.code || dayData.turno || '').toUpperCase();
                if (f >= rangeStart && f <= rangeEnd && isNightCode(code)) {
                    accumulateNightSummary(summaryByMonth, snap.hotel, formatDisplayName(rowData.nombreVisible || rowData.nombre || 'Pendiente'), f);
                }
            });
        });

        const headerHeight = 64;
        const scrollbarHeight = 18;
        const contentHeight = headerHeight + (sorted.length * 62) + scrollbarHeight + 2;
        const maxHeight = Math.floor(window.innerHeight * 0.7);
        const tableHeight = Math.min(contentHeight, maxHeight);
        table.viewport.style.setProperty('height', `${tableHeight}px`, 'important');
        table.viewport.style.setProperty('min-height', '0', 'important');
        table.viewport.style.setProperty('max-height', '70vh', 'important');
        table.setData(sorted);
        requestAnimationFrame(() => {
            if (sorted.length > table.rowPool.length) return;
            const renderedHeight = Math.ceil(table.tableWrap.getBoundingClientRect().height);
            const needsHorizontalScroll = table.viewport.scrollWidth > table.viewport.clientWidth;
            const fittedHeight = renderedHeight + (needsHorizontalScroll ? scrollbarHeight : 0) + 2;
            table.viewport.style.setProperty('height', `${Math.min(fittedHeight, maxHeight)}px`, 'important');
            table.onScroll();
        });
    }

    window.changeWeek = (delta) => {
        const current = _picker.selectedDates[0] || new Date();
        current.setDate(current.getDate() + (delta * 7));
        setWeekRange(current);
        window.renderPublicView();
    };

    function setWeekRange(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d.setDate(diff));
        monday.setHours(12, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        _picker.setDate([monday, sunday]);
    }

    window.goToday = () => {
        setWeekRange(new Date());
        window.renderPublicView();
    };

    // Refresco reactivo (disparado por cambio DB o storage): inmediato, sin preservar estado
    function schedulePublicRefresh() {
        if (_publicRefreshTimer) clearTimeout(_publicRefreshTimer);
        _publicRefreshTimer = setTimeout(() => {
            window.renderPublicView();
        }, 250);
    }

    // Refresco silencioso periódico: preserva scroll, semana, hotel y tema
    function _silentPeriodicRefresh() {
        const idleMs = Date.now() - _lastUserInteractionAt;
        if (idleMs < USER_IDLE_THRESHOLD_MS) {
            console.log('[PUBLIC_REFRESH] Usuario activo, refresco pospuesto.');
            return;
        }
        console.log('[PUBLIC_REFRESH] Refrescando datos sin recargar página.');
        const savedState = _capturePublicState();
        console.log('[PUBLIC_REFRESH] Estado preservado', savedState);
        window.renderPublicView({ _savedState: savedState });
    }

    function _startPeriodicRefresh() {
        if (_publicPeriodicTimer) clearInterval(_publicPeriodicTimer);
        _publicPeriodicTimer = setInterval(() => {
            if (!document.hidden) _silentPeriodicRefresh();
        }, PUBLIC_AUTO_REFRESH_MS);
        console.log('[PUBLIC_REFRESH] Auto-refresh configurado cada 15 minutos.');
    }

    function initPublicRealtime() {
        if (_publicRealtimeChannel || !window.supabase) return;
        _publicRealtimeChannel = window.supabase
            .channel('publicaciones_cuadrante_live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'publicaciones_cuadrante' },
                () => schedulePublicRefresh()
            )
            .subscribe();
    }

    // Rastrear interacción del usuario para posponer auto-refresh si está activo
    ["scroll", "click", "touchstart", "keydown", "change"].forEach(evt => {
        window.addEventListener(evt, () => { _lastUserInteractionAt = Date.now(); }, { passive: true });
    });

    window.addEventListener('storage', (ev) => {
        if (ev.key === 'turnosweb_public_snapshot_updated_at') {
            schedulePublicRefresh();
        }
    });

    // Refresco al volver a la pestaña solo si han pasado al menos 5 minutos desde el último render
    let _lastPublicRenderTime = 0;
    window.addEventListener('focus', () => {
        const now = Date.now();
        if (now - _lastPublicRenderTime > 5 * 60 * 1000) schedulePublicRefresh();
    });
    window.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            const now = Date.now();
            if (now - _lastPublicRenderTime > 5 * 60 * 1000) schedulePublicRefresh();
        }
    });

    document.addEventListener('DOMContentLoaded', async () => {
        const hotelSelect = document.getElementById('hotelSelect');
        if (hotelSelect && window.TurnosRules && window.TurnosRules.getCanonicalHotels) {
            hotelSelect.innerHTML = window.TurnosRules.getCanonicalHotels().map(h => `<option value="${h.value === 'ALL' ? '' : escapeHtml(h.value)}">${escapeHtml(h.label)}</option>`).join('');
        }
        applyTheme(localStorage.getItem('public-theme') || 'day');
        _picker = flatpickr("#dateRange", {
            mode: "range",
            dateFormat: "Y-m-d",
            locale: { ...flatpickr.l10ns.es, firstDayOfWeek: 1 },
            onChange: () => window.renderPublicView()
        });
        initPublicRealtime();
        _startPeriodicRefresh();
        window.goToday();
    });
  
