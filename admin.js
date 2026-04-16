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
    if (!db) {
        window.addLog('ERROR: Conexión a Firebase no disponible.', 'error');
        return;
    }
    try {
        const lastUpdate = new Date().toISOString();
        data.updated_at = lastUpdate;
        
        // Incluimos los perfiles en el paquete de sincronización
        const profiles = JSON.parse(localStorage.getItem('turnosweb_emp_profiles') || '{}');
        data.profiles = profiles;
        
        await db.ref('turnosweb/data').set(data);
        window.parsedData = data; 
        window.saveData();
        
        window.addLog(`NUBE: Fuente de Verdad actualizada (${new Date().toLocaleTimeString()}) ✅`, 'ok');
        window.updateDashboardStats();
        $('#stat-sync').textContent = 'Sincronizado';
        $('#stat-sync').parentElement.classList.add('ok');
    } catch (e) {
        console.error("Error sincronizando:", e);
        window.addLog('ERROR NUBE: Fallo al escribir en la fuente de verdad ❌', 'error');
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
            const raw = typeof t.turno === 'string' ? t.turno : (t.turno.TipoInterpretado || t.turno.TurnoOriginal || '');
            if (t.fecha >= today && t.fecha <= next7Str && window.classify(raw) === 'v') nextVac++;
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
    if (!raw) return '';
    const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (s.startsWith('v')) return 'v';
    if (s.startsWith('b') || s.includes('baja') || s.includes('permis') || s === 'p') return 'b';
    if (s === 'd' || s.startsWith('desc')) return 'd';
    if (s.startsWith('m')) return 'm';
    if (s.startsWith('t')) return 't';
    if (s.startsWith('n')) return 'n';
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
    window.addLog(`Analizando Excel (Hojas: ${wb.SheetNames.join(', ')})...`);
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const SUBS_SHEETS = ['Sustituciones', 'Sustitución', 'Bajas'];
    
    const subs = {};
    const swaps = {};
    const excluded = new Set();
    const scheduleRows = [];
    const allSwapsRaw = [];

    // 1. Procesar Hoja de Sustituciones (si existe)
    const subsSheetName = wb.SheetNames.find(n => SUBS_SHEETS.some(s => n.toLowerCase().includes(s.toLowerCase())));
    if (subsSheetName) {
        window.addLog(`Procesando hoja de ausencias: ${subsSheetName}`);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[subsSheetName], { defval: '' });
        rows.forEach(r => {
            const rawDate = r['Fecha'] || r['Día'];
            const fecha = window.isoDate(rawDate);
            const hotel = String(r['Hotel'] || '').trim();
            const emp = String(r['Empleado'] || '').trim();
            if (!fecha || !emp) return;
            
            const tipo = String(r['Tipo Ausencia'] || r['Tipo'] || '').trim();
            if (tipo.toLowerCase().includes('baja definitiva')) { excluded.add(emp); return; }
            
            const sustit = String(r['Sustituto'] || '').trim();
            const cambio = String(r['Cambio de Turno'] || r['Permuta'] || '').trim();
            
            if (cambio) {
                const key = `${hotel}|${fecha}`;
                if (!swaps[key]) swaps[key] = [];
                swaps[key].push([emp, cambio].sort());
                allSwapsRaw.push({ hotel, fecha, emp1: emp, emp2: cambio });
            }
            if (sustit || tipo) subs[`${hotel}|${fecha}|${emp}`] = { Sustituto: sustit, TipoAusencia: tipo };
        });
    }

    // 2. Procesar Hojas de Hoteles (Detección Automática)
    wb.SheetNames.forEach(sheetName => {
        if (sheetName === subsSheetName) return;
        const sheet = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rawRows.length === 0) return;

        // Verificar si es una hoja de cuadrante (debe tener 'Empleado' o 'Nombre')
        const firstRow = rawRows[0];
        const hasEmpCol = Object.keys(firstRow).some(k => k.trim().toLowerCase().includes('empleado') || k.trim().toLowerCase().includes('nombre'));
        if (!hasEmpCol) return;

        window.addLog(`Procesando cuadrante: ${sheetName} (${rawRows.length} filas)`);
        const weekMap = {};
        rawRows.forEach(rawRow => {
            const row = {}; for (let k in rawRow) row[k.trim()] = rawRow[k];
            
            // Buscar columna de semana
            const semanaCol = Object.keys(row).find(k => k.toLowerCase().includes('semana'));
            const rawSemana = row[semanaCol];
            if (!rawSemana) return;

            const weekDate = typeof rawSemana === 'number' ? new Date((rawSemana - 25569) * 86400 * 1000) : new Date(rawSemana);
            const semana = window.isoDate(window.getMonday(weekDate));
            
            const empCol = Object.keys(row).find(k => k.toLowerCase().includes('empleado') || k.toLowerCase().includes('nombre'));
            const emp = String(row[empCol] || '').trim();
            
            if (!semana || !emp || excluded.has(emp)) return;
            
            if (!weekMap[semana]) weekMap[semana] = { order: [], turnos: {} };
            if (!weekMap[semana].order.includes(emp)) weekMap[semana].order.push(emp);
            
            DIAS.forEach((dia, i) => {
                // Mapeo flexible de días (por si faltan acentos)
                const diaCol = Object.keys(row).find(k => 
                    k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
                        dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    )
                );
                if (diaCol) {
                    const turno = String(row[diaCol] || '').trim();
                    if (turno) weekMap[semana].turnos[`${emp}|${window.addDays(semana, i)}`] = turno;
                }
            });
        });

        // Generar estructura final para este hotel
        Object.entries(weekMap).forEach(([lunes, weekData]) => {
            const turnos = weekData.turnos;
            const fechas = Array.from({ length: 7 }, (_, i) => window.addDays(lunes, i));
            
            // Aplicar Cambios de Turno (Permutas)
            fechas.forEach(fecha => {
                const key = `${sheetName}|${fecha}`;
                (swaps[key] || []).forEach(([a, b]) => {
                    let rawA = turnos[`${a}|${fecha}`] || '', rawB = turnos[`${b}|${fecha}`] || '';
                    const tA = typeof rawA === 'object' ? (rawA.TurnoOriginal || '') : rawA;
                    const tB = typeof rawB === 'object' ? (rawB.TurnoOriginal || '') : rawB;
                    turnos[`${a}|${fecha}`] = { TurnoOriginal: tB + ' 🔄', Sustituto: b, TipoInterpretado: 'C/T' };
                    turnos[`${b}|${fecha}`] = { TurnoOriginal: tA + ' 🔄', Sustituto: a, TipoInterpretado: 'C/T' };
                });
            });

            // Aplicar Sustituciones y Bajas
            const subsInWeek = new Set();
            Object.entries(turnos).forEach(([key, val]) => {
                const [emp, fecha] = key.split('|');
                const subKey = `${sheetName}|${fecha}|${emp}`;
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
            scheduleRows.push({ hotel: sheetName, semana_lunes: lunes, orden_empleados: orden, turnos: turnosArr });
        });
    });

    // --- LÓGICA DE FUSIÓN (MERGE) ---
    if (window.parsedData && window.parsedData.schedule) {
        window.addLog('Comparando con base de datos en tiempo real...');
        let changes = 0;
        // Mantenemos swaps y otros metadatos que ya estuvieran en la nube
        const newSchedule = scheduleRows;
        
        // Aquí podríamos comparar newSchedule con window.parsedData.schedule para loguear diferencias exactas
        window.parsedData.schedule = newSchedule;
        window.parsedData.generated_at = new Date().toISOString();
        window.addLog(`Base de datos actualizada con datos del Excel.`);
    } else {
        window.parsedData = { schedule: scheduleRows, swaps: allSwapsRaw, generated_at: new Date().toISOString() };
    }
    
    window.saveData();
    window.updateDashboardStats();
    window.populatePreview();
    window.populateEmployees();
    window.addLog('Procesamiento completado y listo para sincronizar.', 'ok');
    
    // Sincronizar el resultado final a la Fuente de Verdad
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
    
    const now = monthStr ? new Date(monthStr) : new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const hotels = filterHotel ? [filterHotel] : [...new Set(window.parsedData.schedule.map(g => g.hotel))];
    
    area.innerHTML = hotels.map(hotel => {
        // Obtener empleados de este hotel
        const emps = new Set();
        window.parsedData.schedule.forEach(g => {
            if (g.hotel === hotel) {
                g.turnos.forEach(t => {
                    const tDate = new Date(t.fecha);
                    if (tDate.getFullYear() === year && tDate.getMonth() === month) {
                        emps.add(t.empleado);
                    }
                });
            }
        });

        if (emps.size === 0) return '';

        const sortedEmps = [...emps].sort();
        
        // Cabecera de días
        let headers = '';
        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(year, month, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const dayName = date.toLocaleDateString('es-ES', { weekday: 'narrow' }).toUpperCase();
            const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateISO === todayStr;

            headers += `
                <th class="${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" style="padding:4px; min-width:32px; ${isToday ? 'border:2px solid var(--accent);' : ''}">
                    <div style="font-size:0.65rem; color:var(--text-dim);">${dayName}</div>
                    <div style="font-size:0.85rem; font-weight:800;">${d}</div>
                </th>`;
        }

        // Filas de empleados
        const rows = sortedEmps.map(emp => {
            let cells = '';
            for (let d = 1; d <= totalDays; d++) {
                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                let shiftHtml = '-';
                
                window.parsedData.schedule.forEach(g => {
                    if (g.hotel === hotel) {
                        g.turnos.forEach(t => {
                            if (t.empleado === emp && t.fecha === dayStr) {
                                const raw = typeof t.turno === 'string' ? t.turno : (t.turno.TipoInterpretado || t.turno.TurnoOriginal || '');
                                const cls = window.classify(raw);
                                const label = cls ? cls.toUpperCase() : (raw ? raw[0].toUpperCase() : '-');
                                shiftHtml = `<span class="turno-pill-mini ${cls}">${label}</span>`;
                            }
                        });
                    }
                });
                
                const date = new Date(year, month, d);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = dayStr === todayStr;

                cells += `<td class="${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" style="padding:4px; text-align:center; height:45px;">${shiftHtml}</td>`;
            }
            return `<tr><td style="text-align:left; padding-left:1rem; font-weight:700; background:var(--surface); position:sticky; left:0; z-index:10; white-space:nowrap; border-right:1px solid var(--border);">${emp}</td>${cells}</tr>`;
        });

        return `
            <div class="monthly-sheet-wrap" style="margin-bottom:3rem;">
                <div class="week-head" style="display:flex; justify-content:space-between; align-items:center; padding:1rem 1.5rem; background:linear-gradient(90deg, var(--bg2), var(--bg3)); border-radius:15px 15px 0 0; border:1px solid var(--border); border-bottom:none;">
                    <h3 style="margin:0; font-size:1.1rem; color:var(--accent);">${hotel} <span style="color:var(--text-muted); font-weight:400; font-size:0.9rem;">— ${now.toLocaleDateString('es-ES', {month:'long', year:'numeric'}).toUpperCase()}</span></h3>
                </div>
                <div class="table-container" style="overflow-x:auto; border-radius:0 0 15px 15px; border:1px solid var(--border); background:var(--surface);">
                    <table class="preview-table monthly" style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                        <thead>
                            <tr>
                                <th style="position:sticky; left:0; z-index:11; min-width:150px; background:var(--bg3);">Empleado</th>
                                ${headers}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
};

// ==========================================
// 4. GESTIÓN DE EMPLEADOS Y PERSONAL
// ==========================================
window.calculateStats = () => {
    const stats = {};
    if (!window.parsedData) return stats;
    
    window.parsedData.schedule.forEach(g => {
        g.turnos.forEach(t => {
            if (!stats[t.empleado]) {
                stats[t.empleado] = { 
                    emp: t.empleado, 
                    hotel: g.hotel, 
                    m: 0, t: 0, n: 0, v: 0, d: 0, b:0, x: 0,
                    history: []
                };
            }
            const raw = typeof t.turno === 'string' ? t.turno : (t.turno.TipoInterpretado || t.turno.TurnoOriginal || '');
            const cls = window.classify(raw);
            if (['m', 't', 'n', 'v', 'd', 'b'].includes(cls)) stats[t.empleado][cls]++;
            else stats[t.empleado].x++;

            stats[t.empleado].history.push({
                fecha: t.fecha,
                turno: raw,
                cls: cls,
                original: typeof t.turno === 'object' ? t.turno.TurnoOriginal : t.turno
            });
        });
    });

    // Ordenar historial por fecha descendente
    Object.values(stats).forEach(s => {
        s.history.sort((a,b) => b.fecha.localeCompare(a.fecha));
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
            const totalWork = s.m + s.t + s.n;
            
            return `<div class="emp-card" onclick="window.openEmpDrawer('${s.emp.replace(/'/g, "\\'")}')">
                <div class="emp-card-top">
                    <div class="emp-avatar" style="--emp-hue:${Math.abs(s.emp.length * 17) % 360}">${initials}</div>
                    <div class="emp-card-info">
                        <div class="emp-card-name">${s.emp}</div>
                        <div class="emp-card-hotel">${p.puesto || 'Personal'}</div>
                    </div>
                </div>
                <div class="emp-card-stats">
                    <div class="ecs-item"><span>M</span><b>${s.m}</b></div>
                    <div class="ecs-item"><span>T</span><b>${s.t}</b></div>
                    <div class="ecs-item"><span>N</span><b>${s.n}</b></div>
                    <div class="ecs-item"><span>V</span><b>${s.v}</b></div>
                </div>
                <div class="emp-card-footer">
                    <span>${totalWork} turnos trabajados</span>
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
    const allStats = window.calculateStats();
    const s = allStats[name] || { m:0, t:0, n:0, v:0, b:0, d:0, hotel: 'N/A', history: [] };
    const profiles = JSON.parse(localStorage.getItem('turnosweb_emp_profiles') || '{}');
    const p = profiles[name] || {};
    
    const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    const totalWorking = s.m + s.t + s.n;

    body.innerHTML = `
        <div class="drawer-header">
            <div class="emp-avatar large" style="--emp-hue:${Math.abs(name.length * 17) % 360}">${initials}</div>
            <div class="drawer-title-group">
                <h2 style="margin:0; font-size:1.6rem; letter-spacing:-0.02em;">${name}</h2>
                <div style="display:flex; gap:6px; margin-top:4px;">
                    <span class="status-badge" style="background:var(--accent-dim); color:var(--accent); border:none; font-size:0.7rem;">${s.hotel}</span>
                    <span class="status-badge" style="background:var(--success-dim); color:var(--success); border:none; font-size:0.7rem;">${p.contrato || 'Fijo'}</span>
                </div>
            </div>
        </div>
        
        <div class="drawer-section-title">RESUMEN DE ACTIVIDAD</div>
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

        <div class="glass" style="padding:1.2rem; margin-top:1.5rem; border-color:rgba(255,255,255,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <h4 style="margin:0; color:var(--accent); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">Ficha Técnica</h4>
                <span style="font-size:0.75rem; color:var(--text-dim);">${totalWorking} servicios totales</span>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.85rem;">
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Antigüedad</span><br>
                    <input type="text" class="edit-input" id="edit-antiguedad" value="${p.antiguedad || ''}" placeholder="Ej: 2021" onchange="window.saveEmpField('${name}', 'antiguedad', this.value)">
                </div>
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Categoría</span><br>
                    <input type="text" class="edit-input" id="edit-categoria" value="${p.categoria || ''}" placeholder="Ej: Operativo" onchange="window.saveEmpField('${name}', 'categoria', this.value)">
                </div>
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Puesto</span><br>
                    <input type="text" class="edit-input" id="edit-puesto" value="${p.puesto || ''}" placeholder="Ej: Recepcionista" onchange="window.saveEmpField('${name}', 'puesto', this.value)">
                </div>
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Contrato</span><br>
                    <select class="edit-input" onchange="window.saveEmpField('${name}', 'contrato', this.value)">
                        <option value="Fijo" ${p.contrato === 'Fijo' ? 'selected' : ''}>Fijo</option>
                        <option value="Eventual" ${p.contrato === 'Eventual' ? 'selected' : ''}>Eventual</option>
                        <option value="Sustitución" ${p.contrato === 'Sustitución' ? 'selected' : ''}>Sustitución</option>
                    </select>
                </div>
            </div>
            <div style="margin-top:10px; font-size:0.7rem; color:var(--success); display:none;" id="save-indicator">✓ Cambios guardados y sincronizados</div>
        </div>

        <div class="drawer-section-title" style="margin-top:2rem;">HISTORIAL DE TURNOS RECIENTES</div>
        <div class="history-list">
            ${s.history.slice(0, 15).map(h => `
                <div class="history-item">
                    <div class="hi-date">
                        <span class="hi-day">${new Date(h.fecha).toLocaleDateString('es-ES', {day:'2-digit'})}</span>
                        <span class="hi-month">${new Date(h.fecha).toLocaleDateString('es-ES', {month:'short'}).replace('.','').toUpperCase()}</span>
                    </div>
                    <div class="hi-info">
                        <div class="hi-label">${h.turno}</div>
                        <div class="hi-sub">${h.original !== h.turno ? 'Orig: ' + h.original : s.hotel}</div>
                    </div>
                    <div class="hi-type"><span class="type-dot ${h.cls}"></span></div>
                </div>
            `).join('')}
            ${s.history.length === 0 ? '<div style="padding:2rem; text-align:center; opacity:0.3; font-size:0.8rem;">No hay historial disponible</div>' : ''}
        </div>

        <div style="margin-top:2rem; display:flex; gap:10px; padding-bottom:2rem;">
            <button class="btn active" style="flex:1;" onclick="alert('Generando informe detallado...')">📊 Informe PDF</button>
            <button class="btn" style="flex:1;" onclick="alert('Funcionalidad de edición avanzada en desarrollo')">⚙️ Ajustes</button>
        </div>
    `;
};

window.saveEmpField = (name, field, value) => {
    const profiles = JSON.parse(localStorage.getItem('turnosweb_emp_profiles') || '{}');
    if (!profiles[name]) profiles[name] = {};
    profiles[name][field] = value;
    localStorage.setItem('turnosweb_emp_profiles', JSON.stringify(profiles));

    // Mostrar feedback visual
    const indicator = $('#save-indicator');
    if (indicator) {
        indicator.style.display = 'block';
        setTimeout(() => { if (indicator) indicator.style.display = 'none'; }, 2000);
    }

    // Sincronizar inmediatamente a la nube
    if (window.parsedData) {
        window.syncToFirebase(window.parsedData);
    }
};

window.closeEmpDrawer = () => { $('#empDrawer').classList.remove('open'); };

// ==========================================
// 5. ARRANQUE E INTERACCIONES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.addLog('Iniciando TurnosWeb Admin...');
    const saved = localStorage.getItem('turnosweb_admin_data');
    // --- SISTEMA DE FUENTE DE VERDAD (FIREBASE FIRST) ---
    if (window.firebase && window.firebaseConfig) {
        window.addLog('Conectando a Fuente de Verdad (Firebase)...');
        const fbDb = firebase.database();
        
        // Listener en tiempo real: Cualquier cambio en la nube se refleja en el Admin
        fbDb.ref('turnosweb/data').on('value', (snapshot) => {
            const cloudData = snapshot.val();
            if (cloudData) {
                // Solo sobreescribimos si es la carga inicial o si NO estamos procesando un Excel actulamente
                if (!window.isProcessingExcel) {
                    window.parsedData = cloudData;
                    if (cloudData.profiles) {
                        localStorage.setItem('turnosweb_emp_profiles', JSON.stringify(cloudData.profiles));
                    }
                    window.populatePreview();
                    window.populateEmployees();
                    window.updateDashboardStats();
                    window.addLog('NUBE: Datos sincronizados desde la nube ✅');
                    $('#status-text').textContent = 'Conectado a Nube';
                    $('#status-text').parentElement.classList.add('ok');
                }
            } else {
                window.addLog('NUBE: La base de datos está vacía. Esperando carga inicial.');
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
