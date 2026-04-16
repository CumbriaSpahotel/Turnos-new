// ==========================================
// 1. NÚCLEO Y CONFIGURACIÓN GLOBAL
// ==========================================
window.parsedData = null;
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => document.querySelectorAll(s);

// --- SISTEMA DE LOGS ---
window.addLog = (msg, type = 'info') => {
    const body = $('#logBody');
    if (!body) return;
    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    line.textContent = `> [${new Date().toLocaleTimeString()}] ${msg}`;
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
};

// --- NAVEGACIÓN ---
window.switchSection = (id) => {
    window.addLog(`Cambiando a sección: ${id}`);
    const sections = $$('.section');
    const navItems = $$('.nav-item');
    
    sections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetSec = $(`#section-${id}`);
    if (targetSec) targetSec.classList.add('active');

    const targetNav = $(`#nav-${id}`);
    if (targetNav) targetNav.classList.add('active');
};

window.toggleTheme = () => {
    document.body.classList.toggle('light-mode');
    window.addLog(`Cambiando modo de color`);
};

window.fmtDate = (d) => {
    if (!d || d.length < 10) return d || '—';
    const parts = d.split('-');
    return `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
};

// ==========================================
// 0. FIREBASE SYNC LOGIC
// ==========================================
let db = null;
if (window.firebase && window.firebaseConfig) {
    firebase.initializeApp(window.firebaseConfig);
    db = firebase.database();
    console.log("Firebase inicializado en Admin.");
}

window.syncToFirebase = async (data) => {
    if (!db) return;
    try {
        await db.ref('turnosweb/data').set(data);
        window.addLog('NUBE: Datos sincronizados con Firebase ✅', 'ok');
        window.updateDashboardStats(); // Refrescar estadísticas
    } catch (e) {
        console.error("Error sincronizando:", e);
        window.addLog('ERROR NUBE: No se pudo subir a Firebase ❌', 'error');
    }
};

window.updateDashboardStats = () => {
    const data = window.parsedData;
    if (!data) return;

    // Fecha actual
    const today = new Date().toISOString().split('T')[0];
    const headerDate = document.getElementById('current-date-header');
    if (headerDate) headerDate.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Empleados activos hoy
    let active = 0;
    (data.schedule || []).forEach(g => {
        g.turnos.forEach(t => {
            if (t.fecha === today && t.turno && !String(t.turno).toLowerCase().includes('descanso')) active++;
        });
    });
    const elActive = document.getElementById('stat-active-emp');
    if (elActive) elActive.textContent = active;

    // Permutas
    const elSwaps = document.getElementById('stat-pending-swaps');
    if (elSwaps) elSwaps.textContent = (data.swaps || []).length;

    // Vacaciones (próximas 7 días)
    let nextVac = 0;
    const next7 = new Date(); next7.setDate(next7.getDate() + 7);
    const next7Str = next7.toISOString().split('T')[0];
    (data.schedule || []).forEach(g => {
        g.turnos.forEach(t => {
            if (t.fecha >= today && t.fecha <= next7Str && String(t.turno).toLowerCase().includes('vacaciones')) nextVac++;
        });
    });
    const elVac = document.getElementById('stat-next-vac');
    if (elVac) elVac.textContent = nextVac;

    // Estado Sync
    const elSync = document.getElementById('stat-sync');
    if (elSync) {
        elSync.textContent = db ? 'Sincronizado' : 'Solo Local';
        elSync.parentElement.className = db ? 'status-card ok' : 'status-card';
    }
};

window.isoDate = (date) => {
    if (!date) return '';
    let d;
    if (typeof date === 'number') {
        // Excel base date is 1899-12-30. 
        // Note: 25569 is the number of days between 1899-12-30 and 1970-01-01
        d = new Date((date - 25569) * 86400 * 1000);
    } else {
        d = new Date(date);
    }
    if (isNaN(d.getTime())) return date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

window.addDays = (iso, n) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return window.isoDate(dt);
};

window.getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

window.classify = (raw) => {
    const s = String(raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!s) return '';
    if (s.startsWith('m')) return 'm';
    if (s.startsWith('t')) return 't';
    if (s.startsWith('n')) return 'n';
    if (s.startsWith('d')) return 'd';
    if (s.startsWith('v') || s.includes('vacacion')) return 'v';
    if (s.startsWith('b') || s.includes('baja') || s.includes('permiso')) return 'b';
    return '';
};

window.getShiftClass = (key) => ({ 'm': 'mañana', 't': 'tarde', 'n': 'noche', 'v': 'vacaciones', 'd': 'descanso', 'b': 'baja' }[key] || 'x');

window.saveData = () => {
    if (window.parsedData) localStorage.setItem('turnosweb_admin_data', JSON.stringify(window.parsedData));
};

// ==========================================
// 2. MOTOR DE PROCESAMIENTO EXCEL (PARSER)
// ==========================================
window.processWorkbook = (wb) => {
    window.addLog('Iniciando procesamiento de Excel...');
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const HOTEL_SHEETS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    const SUBS_SHEET = 'Sustituciones';

    const subs = {};
    const swaps = {};
    const excluded = new Set();
    const scheduleRows = [];
    const allSwapsRaw = [];

    if (wb.SheetNames.includes(SUBS_SHEET)) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[SUBS_SHEET], { defval: '' });
        rows.forEach(r => {
            const fecha = window.isoDate(r['Fecha']);
            const hotel = String(r['Hotel'] || '').trim();
            const emp = String(r['Empleado'] || '').trim();
            if (!fecha || !hotel || !emp) return;
            const tipo = String(r['Tipo Ausencia'] || '').trim();
            if (tipo.toLowerCase().includes('baja definitiva')) { excluded.add(emp); return; }
            const sustit = String(r['Sustituto'] || '').trim();
            const cambio = String(r['Cambio de Turno'] || '').trim();
            if (cambio) {
                const key = `${hotel}|${fecha}`;
                if (!swaps[key]) swaps[key] = [];
                swaps[key].push([emp, cambio].sort());
                allSwapsRaw.push({ hotel, fecha, emp1: emp, emp2: cambio });
            }
            if (sustit || tipo) subs[`${hotel}|${fecha}|${emp}`] = { Sustituto: sustit, TipoAusencia: tipo };
        });
    }

    HOTEL_SHEETS.forEach(hotelName => {
        if (!wb.SheetNames.includes(hotelName)) return;
        const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[hotelName], { defval: '' });
        const weekMap = {};
        rawRows.forEach(rawRow => {
            const row = {}; for (let k in rawRow) row[k.trim()] = rawRow[k];
            const rawSemana = row['Semana'];
            if (!rawSemana) return;
            const weekDate = typeof rawSemana === 'number' ? new Date((rawSemana - 25569) * 86400 * 1000) : new Date(rawSemana);
            const semana = window.isoDate(window.getMonday(weekDate));
            const emp = String(row['Empleado'] || '').trim();
            if (!semana || !emp || excluded.has(emp)) return;
            if (!weekMap[semana]) weekMap[semana] = { order: [], turnos: {} };
            if (!weekMap[semana].order.includes(emp)) weekMap[semana].order.push(emp);
            DIAS.forEach((dia, i) => {
                const turno = String(row[dia] || '').trim();
                if (turno) weekMap[semana].turnos[`${emp}|${window.addDays(semana, i)}`] = turno;
            });
        });

        Object.entries(weekMap).forEach(([lunes, weekData]) => {
            const turnos = weekData.turnos;
            const fechas = Array.from({ length: 7 }, (_, i) => window.addDays(lunes, i));
            fechas.forEach(fecha => {
                const key = `${hotelName}|${fecha}`;
                (swaps[key] || []).forEach(([a, b]) => {
                    let rawA = turnos[`${a}|${fecha}`] || '', rawB = turnos[`${b}|${fecha}`] || '';
                    const tA = typeof rawA === 'object' ? (rawA.TurnoOriginal || '') : rawA;
                    const tB = typeof rawB === 'object' ? (rawB.TurnoOriginal || '') : rawB;
                    turnos[`${a}|${fecha}`] = { TurnoOriginal: tB + ' 🔄', Sustituto: b, TipoInterpretado: 'C/T' };
                    turnos[`${b}|${fecha}`] = { TurnoOriginal: tA + ' 🔄', Sustituto: a, TipoInterpretado: 'C/T' };
                });
            });
            const subsInWeek = new Set();
            Object.entries(turnos).forEach(([key, val]) => {
                const [emp, fecha] = key.split('|');
                const subKey = `${hotelName}|${fecha}|${emp}`;
                if (subs[subKey]) {
                    const s = subs[subKey];
                    const originalStr = typeof val === 'object' ? (val.TurnoOriginal || '') : val;
                    turnos[key] = { TurnoOriginal: originalStr, Sustituto: s.Sustituto, TipoInterpretado: s.TipoAusencia || 'Ausencia' };
                    if (s.Sustituto) subsInWeek.add(s.Sustituto);
                }
            });
            const orden = [...weekData.order];
            subsInWeek.forEach(s => { if (!orden.includes(s)) orden.push(s); });
            const turnosArr = Object.entries(turnos).map(([k, v]) => {
                const [empleado, fecha] = k.split('|');
                return { empleado, fecha, turno: v };
            });
            scheduleRows.push({ hotel: hotelName, semana_lunes: lunes, orden_empleados: orden, turnos: turnosArr });
        });
    });

    window.parsedData = { schedule: scheduleRows, swaps: allSwapsRaw, generated_at: new Date().toISOString() };
    window.saveData();
    window.updateDashboardStats();
    window.populatePreview();
    window.populateEmployees();
    window.addLog('Procesamiento completado.', 'ok');
    
    // Sincronizar con Firebase
    if (window.parsedData) window.syncToFirebase(window.parsedData);
};

// ==========================================
// 3. MOTOR DE VISTAS (PREVIEW)
// ==========================================
window._previewMode = 'weekly';
window.switchPreviewMode = (mode) => {
    window._previewMode = mode;
    const btnW = $('#btnViewWeekly'), btnM = $('#btnViewMonthly');
    if (btnW) btnW.classList.toggle('active', mode === 'weekly');
    if (btnM) btnM.classList.toggle('active', mode === 'monthly');
    window.renderPreview();
};

window.renderPreview = () => {
    const hotel = $('#prevHotel')?.value || '';
    if (window._previewMode === 'weekly') window.renderWeeklyPreview(hotel, $('#prevWeekDate')?.value);
    else window.renderMonthlyCalendar(hotel, $('#prevMonth')?.value);
};

window.populatePreview = () => {
    if (!window.parsedData) return;
    const hotels = [...new Set(window.parsedData.schedule.map(g => g.hotel))].sort();
    const prevHotel = $('#prevHotel');
    if (prevHotel) {
        prevHotel.innerHTML = '<option value="">— Todo —</option>' + hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    }
    const weekInp = $('#prevWeekDate');
    if (weekInp && !weekInp.value) weekInp.value = window.isoDate(new Date());
    window.renderPreview();
};

window.renderWeeklyPreview = (filterHotel, filterDate) => {
    const area = $('#previewContent'); if (!window.parsedData || !area) return;
    let groups = window.parsedData.schedule;
    if (filterHotel) groups = groups.filter(g => g.hotel === filterHotel);
    
    if (filterDate) {
        const dt = new Date(filterDate); 
        const off = (dt.getDay() === 0 ? -6 : 1 - dt.getDay());
        dt.setDate(dt.getDate() + off); 
        const mondayIso = window.isoDate(dt);
        groups = groups.filter(g => g.semana_lunes === mondayIso);
    }

    if (groups.length === 0) {
        area.innerHTML = `<div class="glass" style="padding:3rem; text-align:center; color:var(--text-muted);">No hay turnos registrados para esta fecha/hotel.</div>`;
        return;
    }

    area.innerHTML = groups.map(g => {
        const weekDays = Array.from({ length: 7 }, (_, i) => window.addDays(g.semana_lunes, i));
        
        // Cabeceras de tabla
        const headers = weekDays.map(dayIso => {
            const d = new Date(dayIso);
            const name = ['D','L','M','X','J','V','S'][d.getDay()];
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return `<th class="${isWeekend ? 'weekend' : ''}">
                <span class="day-name">${name}</span>
                <span class="day-number">${window.fmtDate(dayIso).split('/').slice(0,2).join('/')}</span>
            </th>`;
        }).join('');

        const grid = {};
        g.turnos.forEach(t => { 
            if (!grid[t.empleado]) grid[t.empleado] = {}; 
            grid[t.empleado][t.fecha] = t.turno; 
        });

        const rows = g.orden_empleados.map(emp => {
            const cells = weekDays.map((day, i) => {
                const val = grid[emp]?.[day] || '';
                let label = typeof val === 'object' ? (val.TurnoOriginal || '—') : val;
                if (!label) label = '—';
                
                const shiftCls = window.getShiftClass(window.classify(label));
                const isWeekend = i >= 5; // S, D are indices 5, 6
                const isSwap = typeof val === 'object' && val.TipoInterpretado === 'C/T';
                
                return `<td class="${isWeekend ? 'weekend' : ''}">
                    <span class="turno-pill turno-${shiftCls}">
                        ${String(label).replace(/[🔄]/g, '').trim()} ${isSwap ? '🔄' : ''}
                    </span>
                </td>`;
            }).join('');
            return `<tr><td><b>${emp}</b></td>${cells}</tr>`;
        });

        return `
        <div class="preview-week week">
            <div class="preview-week-header week-head">
                <h3>${g.hotel} — Semana del ${window.fmtDate(g.semana_lunes)}</h3>
            </div>
            <div class="preview-table-wrap table-container">
                <table class="preview-table">
                    <thead>
                        <tr>
                            <th>Personal</th>
                            ${headers}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }).join('');
};

window.renderMonthlyCalendar = (filterHotel, monthStr) => {
    const area = $('#previewContent'); if (!window.parsedData || !area) return;
    area.innerHTML = '';
    
    const now = monthStr ? new Date(monthStr + '-01') : new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Header navigación mes (UI simple para el admin)
    const header = document.createElement('div');
    header.className = 'calendar-month-nav';
    header.innerHTML = `
        <div class="cal-month-title">${now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</div>
        <div class="cal-legend">
            <div class="cal-legend-item"><span class="cal-legend-dot legend-m"></span> Mañanas</div>
            <div class="cal-legend-item"><span class="cal-legend-dot legend-t"></span> Tardes</div>
            <div class="cal-legend-item"><span class="cal-legend-dot legend-n"></span> Noches</div>
            <div class="cal-legend-item"><span class="cal-legend-dot legend-d"></span> Descansos</div>
            <div class="cal-legend-item"><span class="cal-legend-dot legend-v"></span> Vacaciones</div>
        </div>
    `;
    area.appendChild(header);

    const gridWrap = document.createElement('div');
    gridWrap.className = 'calendar-wrap';
    
    const daysHeader = document.createElement('div');
    daysHeader.className = 'calendar-header-days';
    ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(d => {
        daysHeader.innerHTML += `<div class="ch-day">${d}</div>`;
    });
    gridWrap.appendChild(daysHeader);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Celdas vacías mes anterior
    for (let i = 0; i < startOffset; i++) {
        grid.innerHTML += `<div class="cal-cell other-month"></div>`;
    }
    
    // Días del mes
    for (let d = 1; d <= totalDays; d++) {
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dayStr === new Date().toISOString().split('T')[0];
        const isWeekend = new Date(year, month, d).getDay() % 6 === 0;
        
        let eventsHtml = '';
        window.parsedData.schedule.forEach(g => {
            if (filterHotel && g.hotel !== filterHotel) return;
            g.turnos.forEach(t => {
                if (t.fecha === dayStr) {
                    const cls = window.classify(typeof t.turno === 'string' ? t.turno : (t.turno?.TurnoOriginal || ''));
                    if (cls && cls !== 'd') {
                        eventsHtml += `<div class="cal-event ${cls}" title="${t.empleado}: ${t.turno?.TurnoOriginal || t.turno}">
                            <span class="cal-hotel-tag">${g.hotel[0]}</span> ${t.empleado.split(' ')[0]}
                        </div>`;
                    }
                }
            });
        });

        grid.innerHTML += `
            <div class="cal-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">
                <div class="cal-day-num">${d}</div>
                <div class="cal-events">${eventsHtml}</div>
            </div>
        `;
    }
    
    gridWrap.appendChild(grid);
    area.appendChild(gridWrap);
};

// ==========================================
// 4. GESTIÓN DE EMPLEADOS Y PERSONAL
// ==========================================
window.calculateStats = () => {
    const stats = {};
    if (!window.parsedData) return stats;
    window.parsedData.schedule.forEach(g => {
        g.turnos.forEach(t => {
            if (!stats[t.empleado]) stats[t.empleado] = { emp: t.empleado, hotel: g.hotel, m: 0, t: 0, n: 0, v: 0, d: 0, b:0 };
            const cls = window.classify(typeof t.turno === 'string' ? t.turno : (t.turno?.TurnoOriginal || ''));
            if (['m', 't', 'n', 'v', 'd', 'b'].includes(cls)) stats[t.empleado][cls]++;
        });
    });
    return stats;
};

window.populateEmployees = () => {
    const area = $('#employeesContent'); if (!area || !window.parsedData) return;
    const profiles = JSON.parse(localStorage.getItem('turnosweb_emp_profiles') || '{}');
    const stats = window.calculateStats();
    const hotels = [...new Set(Object.values(stats).map(s => s.hotel))].sort();
    area.innerHTML = hotels.map(hotel => {
        const emps = Object.values(stats).filter(s => s.hotel === hotel).sort((a, b) => a.emp.localeCompare(b.emp));
        const cards = emps.map(s => {
            const p = profiles[s.emp] || {};
            const initials = s.emp.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return `<div class="emp-card" onclick="window.openEmpDrawer('${s.emp.replace(/'/g, "\\'")}')">
                <div class="emp-card-top">
                    <div class="emp-avatar" style="--emp-hue:${Math.abs(s.emp.length * 17) % 360}">${initials}</div>
                    <div class="emp-card-info">
                        <div class="emp-card-name">${s.emp}</div>
                        <div class="emp-card-hotel">${p.contrato || 'Fijo'}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
        return `<div class="emp-hotel-section"><h2>${hotel}</h2><div class="employees-grid-inner">${cards}</div></div>`;
    }).join('');
};

window.openEmpDrawer = (name) => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    if (!drawer || !body) return;
    
    drawer.classList.add('open');
    const stats = window.calculateStats()[name] || { m:0, t:0, n:0, v:0, b:0, d:0, hotel: 'N/A' };
    const profiles = JSON.parse(localStorage.getItem('turnosweb_emp_profiles') || '{}');
    const p = profiles[name] || {};
    
    body.innerHTML = `
        <div class="drawer-header">
            <div class="emp-avatar large" style="--emp-hue:${Math.abs(name.length * 17) % 360}">
                ${name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div class="drawer-title-group">
                <h2 style="margin:0; font-size:1.5rem;">${name}</h2>
                <span class="status-badge" style="background:var(--success-dim); color:var(--success); border:none;">${stats.hotel}</span>
            </div>
        </div>
        
        <div class="drawer-stats-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin: 1.5rem 0;">
            <div class="stat-mini"><span>Mañanas</span><strong>${stats.m}</strong></div>
            <div class="stat-mini"><span>Tardes</span><strong>${stats.t}</strong></div>
            <div class="stat-mini"><span>Noches</span><strong>${stats.n}</strong></div>
            <div class="stat-mini"><span>Descansos</span><strong>${stats.d}</strong></div>
            <div class="stat-mini"><span>Vacaciones</span><strong>${stats.v}</strong></div>
            <div class="stat-mini"><span>Bajas</span><strong>${stats.b}</strong></div>
        </div>

        <div class="glass" style="padding:1.2rem; margin-top:1rem;">
            <h4 style="margin-top:0; border-bottom:1px solid var(--border); padding-bottom:5px; color:var(--accent);">INFORMACIÓN LABORAL</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.85rem; margin-top:10px;">
                <div><span style="color:var(--text-dim)">Contrato:</span><br><b>${p.contrato || 'Indefinido'}</b></div>
                <div><span style="color:var(--text-dim)">Antigüedad:</span><br><b>${p.antiguedad || '—'}</b></div>
                <div><span style="color:var(--text-dim)">Categoría:</span><br><b>${p.categoria || 'Operativo'}</b></div>
                <div><span style="color:var(--text-dim)">Puesto:</span><br><b>${p.puesto || 'Recepción'}</b></div>
            </div>
        </div>

        <div style="margin-top:1.5rem; display:flex; gap:10px;">
            <button class="btn active" style="flex:1;" onclick="alert('Funcionalidad en desarrollo: Imprimir Ficha')">🖨️ Imprimir</button>
            <button class="btn" style="flex:1;" onclick="alert('Funcionalidad en desarrollo: Editar Perfil')">✏️ Editar</button>
        </div>
    `;
};

window.closeEmpDrawer = () => { $('#empDrawer').classList.remove('open'); };

// ==========================================
// 5. ARRANQUE E INTERACCIONES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.addLog('Iniciando TurnosWeb Admin...');
    const saved = localStorage.getItem('turnosweb_admin_data');
    if (saved) {
        window.parsedData = JSON.parse(saved);
        $('#status-text').textContent = 'Datos en memoria';
        $('#status-text').parentElement.classList.add('ok');
        window.populatePreview();
        window.populateEmployees();
        window.addLog('Base de datos recuperada del navegador.');
    }

    // --- NUEVO: Sincronización automática desde la NUBE ---
    if (window.firebase && window.firebaseConfig && !window.parsedData) {
        window.addLog('Buscando datos en la nube...');
        const fbDb = firebase.database();
        fbDb.ref('turnosweb/data').once('value').then((snapshot) => {
            const cloudData = snapshot.val();
            if (cloudData && !window.parsedData) {
                window.addLog('NUBE: Sincronización inicial completada ✅', 'ok');
                window.parsedData = cloudData;
                window.populatePreview();
                window.populateEmployees();
                window.updateDashboardStats();
            }
        });
    }

    const dropZone = $('#drop-zone');
    const fileIn = $('#fileInput');

    if (dropZone) {
        dropZone.onclick = () => fileIn.click();
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
        dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFile(e.dataTransfer.files[0]);
        };
    }

// ==========================================
// 5. BACKUP Y CONFIGURACIÓN (RESTAURACIÓN)
// ==========================================
window.exportConfig = () => {
    const data = {
        main: JSON.parse(localStorage.getItem('turnosweb_admin_data') || 'null'),
        profiles: JSON.parse(localStorage.getItem('turnosweb_emp_profiles') || 'null'),
        export_date: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turnosweb_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.addLog('Backup generado y descargado.', 'ok');
};

window.importConfig = () => {
    const file = $('#configImport').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.main) localStorage.setItem('turnosweb_admin_data', JSON.stringify(data.main));
            if (data.profiles) localStorage.setItem('turnosweb_emp_profiles', JSON.stringify(data.profiles));
            window.addLog('Configuración restaurada con éxito.', 'ok');
            location.reload();
        } catch (err) {
            window.addLog('Error al importar: ' + err.message, 'err');
        }
    };
    reader.readAsText(file);
};

if (fileIn) fileIn.onchange = (e) => handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (!file) return;
    window.addLog(`Leyendo: ${file.name}`);
    const r = new FileReader();
    r.onload = (ev) => {
        try {
            const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true });
            window.processWorkbook(wb);
        } catch (e) {
            window.addLog('Error: ' + e.message, 'err');
        }
    };
    r.readAsArrayBuffer(file);
}
