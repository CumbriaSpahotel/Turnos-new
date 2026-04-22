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
// 2. EXCEL SOURCE LOADER
// ==========================================
async function loadExcelSourceRows() {
    if (window._cachedExcelSource) return window._cachedExcelSource;
    const EXCEL_FILE = 'Plantilla%20Cuadrante%20Turnos%20v.8.0.xlsx';
    const SHEETS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    
    try {
        const response = await fetch(EXCEL_FILE, { cache: 'no-store' });
        if (!response.ok) throw new Error('Excel not found');
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const result = {};

        SHEETS.forEach(h => {
            const sheet = workbook.Sheets[h];
            if (!sheet) return;
            const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
            result[h] = matrix.slice(1).map((row, index) => ({
                hotel: h,
                rowIndex: index,
                weekStart: window.isoDate(row[0]),
                displayName: String(row[1] || '').trim(),
                empleadoId: String(row[1] || '').trim(),
                values: [2,3,4,5,6,7,8].map(i => {
                    const val = String(row[i] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                    if (!val) return '';
                    if (val.startsWith('m')) return 'M';
                    if (val.startsWith('t')) return 'T';
                    if (val.startsWith('n')) return 'N';
                    if (val.startsWith('d')) return 'D';
                    return String(row[i] || '').trim();
                })
            })).filter(r => r.weekStart && r.empleadoId);
        });

        window._cachedExcelSource = result;
        return result;
    } catch (e) {
        console.warn('Excel source load failed:', e);
        return {};
    }
}

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

        let data = await window.TurnosDB.fetchRangoCalculado(startISO, endISO);
        const hotels = await window.TurnosDB.getHotels();
        const profiles = await window.TurnosDB.getEmpleados();
        const excelSource = await loadExcelSourceRows();
        
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
                                            return `<td style="padding:8px; text-align:center; border-left:1px solid #f1f5f9;"><div style="display:inline-flex; align-items:center; justify-content:center; padding:10px 4px; width:100%; border-radius:10px; font-size:0.75rem; font-weight:800; ${visual.adminStyle}">${visual.label || s.turno || ''}${visual.icon || ''}</div></td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
                area.appendChild(hotelSection);
            } else {
                // Monthly Calendar logic (as previously implemented but clean)
                const hotelSection = document.createElement('div');
                hotelSection.className = 'hotel-calendar-view';
                hotelSection.style.marginBottom = '2.5rem';
                const firstDay = new Date(columns[0].date + 'T12:00:00');
                const startDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); 
                const hNorm = window.TurnosEngine.normalizeString(hName);
                const hDataFull = data.filter(t => window.TurnosEngine.normalizeString(t.hotel_id) === hNorm);
                const cells = [];
                for (let i = 1; i < startDow; i++) cells.push('<div class="cal2-cell cal2-empty"></div>');
                columns.forEach(col => {
                    const diaData = hDataFull.filter(t => t.fecha === col.date);
                    const groups = { M: [], T: [], N: [], D: [], ABS: [] };
                    diaData.forEach(t => {
                        const shift = (t.turno || '').toLowerCase();
                        const empName = String(t.empleado_id || '').split(' ')[0];
                        if (window.TurnosRules.isAbsenceType(t.tipo)) {
                            const v = window.TurnosRules.describeCell(t);
                            groups.ABS.push({ name: empName, icon: v.icon, cls: v.key === 'v' ? 'vac' : v.key });
                        } else if (shift.startsWith('m')) groups.M.push(empName);
                        else if (shift.startsWith('t')) groups.T.push(empName);
                        else if (shift.startsWith('n')) groups.N.push(empName);
                        else if (shift.startsWith('d')) groups.D.push(empName);
                    });
                    const badge = (list, cls, icon) => list.length ? `<div class="cal2-group cal2-${cls}"><span class="cal2-icon">${icon}</span><span class="cal2-names">${list.join(' · ')}</span></div>` : '';
                    cells.push(`<div class="cal2-cell"><div class="cal2-daynum">${new Date(col.date + 'T12:00:00').getDate()}</div><div class="cal2-content">${badge(groups.M,'m','☀️')}${badge(groups.T,'t','🌤️')}${badge(groups.N,'n','🌙')}${badge(groups.D,'d','😴')}${groups.ABS.map(a => `<div class="cal2-group cal2-${a.cls}"><span class="cal2-icon">${a.icon}</span><span class="cal2-names">${a.name}</span></div>`).join('')}</div></div>`);
                });
                const endDow = new Date(columns[columns.length-1].date + 'T12:00:00').getDay() || 7;
                for (let i = endDow; i < 7; i++) cells.push('<div class="cal2-cell cal2-empty"></div>');
                hotelSection.innerHTML = `<div style="background:white; border-radius:18px; overflow:hidden; border:1px solid #e8ecf0;"><div style="padding:15px 20px; background:#f8fafc; border-bottom:1px solid #e4e9f0; font-weight:800;">${hName}</div><div class="cal2-header"><div>LUN</div><div>MAR</div><div>MIÉ</div><div>JUE</div><div>VIE</div><div>SÁB</div><div>DOM</div></div><div class="cal2-grid">${cells.join('')}</div></div>`;
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
