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

window.renderExcelView = () => {
    const container = $('#excel-grid-container');
    if (container) {
        // Lógica de renderizado de tabla aquí
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-dim);">Vista de tabla de Supabase activa.</div>';
    }
}

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
        const excelSource = await window.ExcelLoader.loadExcelSourceRows();
        
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
            const weekExcelRows = (excelSource[hName] || []).filter(row => row.weekStart === startISO);
            if (isWeekly && weekExcelRows.length === 0) continue;

            if (isWeekly) {
                const rosterGrid = window.TurnosEngine.buildRosterGrid({
                    rows: data,
                    events: eventos,
                    employees: profiles,
                    dates: columns.map(c => c.date),
                    hotel: hName,
                    sourceRows: weekExcelRows
                });

                if (rosterGrid.entries.length === 0) continue;

                const hotelSection = document.createElement('div');
                hotelSection.innerHTML = `
                <div class="glass-panel" style="margin-bottom:3rem; padding:0; overflow:hidden; border:1px solid #e2e8f0; background:white; border-radius:16px;">
                    <div style="padding:18px 25px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:15px; background:#f8fafc;">
                        <img src="${hName.toLowerCase().includes('guadiana') ? 'guadiana logo.jpg' : 'cumbria logo.jpg'}" style="width:38px; height:38px; object-fit:contain;">
                        <h2 style="margin:0; font-size:1.1rem; color:#1e293b; font-weight:800;">${hName} <span style="color:#94a3b8; font-size:0.85rem;">Semana ${window.fmtDateLegacy(startISO)}</span></h2>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="preview-table-premium" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:15px 25px; text-align:left; border-bottom:1px solid #f1f5f9; width:220px; color:#64748b; font-size:0.7rem; text-transform:uppercase; position:sticky; left:0; background:#f8fafc; z-index:10;">Empleado</th>
                                    ${columns.map(c => `<th style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:110px; border-left:1px solid #f1f5f9;"><div style="font-size:0.65rem; color:#94a3b8;">${c.dayName}</div><div style="font-size:0.75rem; font-weight:600;">${c.dayDisplay.toLowerCase()}</div></th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${rosterGrid.entries.map(entry => `
                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:12px 25px; background:white; position:sticky; left:0; z-index:5; border-right:1px solid #f1f5f9;">
                                            <span style="font-weight:700; color:var(--accent); font-size:0.85rem;">${escapeHtml(entry.displayAs)}</span>
                                        </td>
                                        ${entry.cells.map(s => {
                                            const visual = window.TurnosRules.describeCell(s);
                                            return `<td style="padding:8px; text-align:center; border-left:1px solid #f1f5f9;"><div title="${escapeHtml(visual.title || '')}" style="display:inline-flex; align-items:center; justify-content:center; padding:10px 4px; width:100%; border-radius:10px; font-size:0.75rem; font-weight:800; cursor:help; ${visual.adminStyle}">${visual.label || s.turno || ''}${visual.icon || ''}</div></td>`;
                                        }).join('')}
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

                rosterDates.forEach((dateKey, dayIdx) => {
                    const groups = { M: [], T: [], N: [], D: [], ABS: [] };
                    
                    rosterGrid.entries.forEach(entry => {
                        const cellData = entry.cells[dayIdx];
                        const visual = window.TurnosRules.describeCell(cellData);
                        const empName = String(entry.displayAs || '').split(' ')[0];

                        if (visual.key === 'v' || visual.key === 'b' || visual.key === 'p') {
                            groups.ABS.push({ name: empName, icon: visual.icon, cls: visual.key === 'v' ? 'vac' : visual.key, title: visual.title });
                        } else if (visual.key === 'm') groups.M.push({ name: empName, title: visual.title, icon: visual.icon });
                        else if (visual.key === 't') groups.T.push({ name: empName, title: visual.title, icon: visual.icon });
                        else if (visual.key === 'n') groups.N.push({ name: empName, title: visual.title, icon: visual.icon });
                        else if (visual.key === 'd') groups.D.push({ name: empName, title: visual.title, icon: visual.icon });
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
        
        const excelSource = await window.ExcelLoader.loadExcelSourceRows();
        
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
                const dateObj = new Date(date + 'T12:00:00');
                const dow = dateObj.getDay() || 7;
                const sourceIndex = dow - 1;

                // Lunes correspondiente a este día
                const weekStartObj = new Date(dateObj);
                weekStartObj.setDate(dateObj.getDate() - (dow - 1));
                const weekStartIso = window.isoDate(weekStartObj) || weekStartObj.toISOString().split('T')[0];

                const weekExcelRows = (excelSource[hName] || []).filter(r => r.weekStart === weekStartIso);
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
