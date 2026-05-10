// describeCell centralizado en turnos-rules.js

window.formatDisplayName = (name) => {
    if (!name) return '';
    return name.replace(/_DUP_.*$/, '').replace(/_CT$/, '').replace(/_/g, ' ').trim();
};
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => document.querySelectorAll(s);
window.safeGet = (id) => document.getElementById(id) || { textContent: '', style: {}, innerHTML: '', value: '' };
window.isoDate = (date) => {
    if (!date) return null;
    const d = (typeof date === 'string') ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
window.fmtDateLegacy = (dateStr) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
};

window._previewMode = 'weekly';
window._previewDate = window.isoDate(new Date()); 

window.getWeekStartISO = (date) => {
    const d = new Date(date + 'T12:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return window.isoDate(new Date(d.setDate(diff)));
};

window.getDayOffsetFromWeek = (weekStart, date) => {
    const s = new Date(weekStart + 'T12:00:00');
    const d = new Date(date + 'T12:00:00');
    return Math.round((d - s) / 86400000);
};

window.addIsoDays = (iso, days) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return window.isoDate(d);
};

window.getFechasSemana = (weekStart) => {
    return [0,1,2,3,4,5,6].map(i => window.addIsoDays(weekStart, i));
};

window.getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

window.escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

window.addLog = (msg, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    const timeline = document.getElementById('dashboard-timeline');
    if (timeline) {
        const item = document.createElement('div');
        item.className = `activity-log-item ${type}`;
        item.style = 'padding: 10px 20px; border-bottom: 1px solid #eee; font-size: 0.8rem;';
        item.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> ${msg}`;
        timeline.prepend(item);
    }
};

window.getAvailableHotels = async () => {
    try {
        const hotels = await window.TurnosDB.getHotels();
        if (hotels && hotels.length > 0) return hotels;
    } catch(e) {}
    return ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
};

// --- V9 EXCEL ORDER MAP HELPERS ---
window.v9ExcelOrderMap = null;

window.resolveId = window.resolveId || ((raw) => window.normalizeId ? window.normalizeId(raw) : String(raw || '').trim());

window.normalizeV9Key = (value) => {
    if (value === null || value === undefined) return '';
    let s = String(value);
    
    // 1. Convertir a string segura (ya hecho arriba)
    
    // 2. Normalizar Unicode NFKD (separa diacríticos)
    s = s.normalize('NFKD');
    
    // 3. Eliminar marcas diacríticas (acentos, virgulillas, etc.)
    s = s.replace(/[\u0300-\u036f]/g, '');
    
    // 4. Eliminar soft hyphen (\u00AD)
    s = s.replace(/\u00AD/g, '');
    
    // 5. Eliminar zero-width chars
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // 6. Eliminar caracteres de control
    s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // 7. Sustituir apóstrofes y guiones raros
    s = s.replace(/['`´‘’]/g, "'").replace(/[‐‑‒–—―]/g, "-");
    
    // 8. Sustituir espacios no separables por espacio normal
    s = s.replace(/[\u00A0\u202F]/g, " ");
    
    // 9. Colapsar espacios múltiples
    s = s.replace(/\s+/g, ' ');
    
    // 10. Trim
    s = s.trim();
    
    // 11. Lowercase
    s = s.toLowerCase();
    
    return s;
};

// Alias para retrocompatibilidad si fuera necesario, pero usaremos el nuevo nombre
window.normalizeForV9 = window.normalizeV9Key;

window.loadV9ExcelOrderMap = async () => {
    if (window.v9ExcelOrderMap) return window.v9ExcelOrderMap;
    
    let rawData = null;
    
    // 1. Intentar usar variable global pre-cargada (Bypass CORS en file://)
    if (window._v9_excel_order_data) {
        console.log("[V9_ORDER] Usando mapa de orden pre-cargado desde JS variable.");
        rawData = window._v9_excel_order_data;
    } else {
        try {
            console.log("[V9_ORDER] Cargando mapa de orden desde data/v9_excel_order_map.json...");
            const response = await fetch('data/v9_excel_order_map.json');
            if (response.ok) {
                rawData = await response.json();
            }
        } catch (err) {
            console.warn("[V9_ORDER] Error al cargar JSON (CORS?).");
        }
    }

    if (!rawData) {
        console.warn("[V9_ORDER] No se pudo obtener el mapa de orden. Usando fallback vacío.");
        window.v9ExcelOrderMap = new Map();
        return window.v9ExcelOrderMap;
    }

    // Indexar para búsqueda rápida: [hotel][week][empleado] -> orderData
    const index = {};
    rawData.forEach(item => {
        const h = window.normalizeV9Key(item.hotel);
        const w = item.week_start;
        const e = window.normalizeV9Key(item.empleado_id);
        
        if (!index[h]) index[h] = {};
        if (!index[h][w]) index[h][w] = {};
        
        index[h][w][e] = item;
    });
    
    window.v9ExcelOrderMap = index; // Guardamos la estructura anidada
    console.log(`[V9_ORDER] Mapa indexado: ${rawData.length} entradas.`);
    return index;
};

window.getV9ExcelOrder = (hotel, weekStart, empleado) => {
    if (!window.v9ExcelOrderMap) return null;
    
    const hKey = window.normalizeV9Key(hotel);
    const wKey = weekStart; // ISO YYYY-MM-DD
    const eKey = window.normalizeV9Key(empleado);
    
    const hotelData = window.v9ExcelOrderMap[hKey];
    if (!hotelData) return null;
    
    const weekData = hotelData[wKey];
    if (!weekData) return null;
    
    const item = weekData[eKey];
    return item ? item.order : null;
};

window.debugV9OrderLookup = (hotel, weekStart, empleado) => {
    const hKey = window.normalizeV9Key(hotel);
    const wKey = weekStart;
    const eKey = window.normalizeV9Key(empleado);
    
    console.log(`[DEBUG_V9] Lookup: "${hotel}" | "${weekStart}" | "${empleado}"`);
    console.log(`[DEBUG_V9] Keys: h="${hKey}" | w="${wKey}" | e="${eKey}"`);
    
    const hotelData = window.v9ExcelOrderMap ? window.v9ExcelOrderMap[hKey] : null;
    const weekData = hotelData ? hotelData[wKey] : null;
    const item = weekData ? weekData[eKey] : null;
    
    if (weekData) {
        console.log(`[DEBUG_V9] Keys disponibles para esta semana:`, Object.keys(weekData));
    } else {
        console.warn(`[DEBUG_V9] No hay datos para el hotel/semana indicados.`);
    }
    
    if (item) {
        console.log(`[DEBUG_V9] MATCH ENCONTRADO:`, item);
    } else {
        console.error(`[DEBUG_V9] SIN COINCIDENCIA.`);
    }
    
    return item ? item.order : null;
};

// --- FIN V9 HELPERS ---

// --- FIX DATA

// ==========================================
// MÓDULO: ESTADO DE CONEXIÓN SUPABASE
// ==========================================
window.connectionState = {
    status: 'connecting',
    checkedAt: null,
    message: ''
};

window.updateConnectionUI = (status, msg = '') => {
    window.connectionState.status = status;
    window.connectionState.checkedAt = new Date();
    window.connectionState.message = msg;

    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    const kpi = document.getElementById('stat-cloud-status');
    const container = document.getElementById('syncStatus');

    if (!dot || !text) return;

    const config = {
        connecting: { color: '#f59e0b', text: 'Conectando...', kpi: '...' },
        connected: { color: '#10b981', text: 'Supabase conectado', kpi: 'Online' },
        error: { color: '#ef4444', text: 'Error de conexión', kpi: 'Offline' },
        unconfigured: { color: '#64748b', text: 'Sin configurar', kpi: 'N/A' }
    };

    const state = config[status] || config.error;
    dot.style.background = state.color;
    text.textContent = state.text;
    if (kpi) {
        kpi.textContent = state.kpi;
        kpi.style.color = state.color;
    }

    if (status === 'error') {
        container.title = msg;
        if (!document.getElementById('btn-retry-conn')) {
            const btn = document.createElement('button');
            btn.id = 'btn-retry-conn';
            btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            btn.style = 'margin-left:8px; border:none; background:none; color:var(--text-dim); cursor:pointer; font-size:0.7rem;';
            btn.onclick = (e) => {
                e.stopPropagation();
                window.checkSupabaseConnection();
            };
            container.appendChild(btn);
        }
    } else {
        const btn = document.getElementById('btn-retry-conn');
        if (btn) btn.remove();
    }
};

window.checkSupabaseConnection = async () => {
    window.updateConnectionUI('connecting');
    
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tiempo de espera agotado al conectar con Supabase')), 5000)
    );

    try {
        if (!window.supabase || !window.TurnosDB) {
            throw new Error('Cliente Supabase no inicializado');
        }

        // Prueba real de consulta
        const query = window.supabase.from('empleados').select('count', { count: 'exact', head: true });
        await Promise.race([query, timeout]);
        
        window.updateConnectionUI('connected');
        console.log("[CONN] Supabase conectado correctamente.");
    } catch (err) {
        console.error("[CONN ERROR]", err);
        const isConfigError = err.message.includes('URL') || err.message.includes('Key');
        window.updateConnectionUI(isConfigError ? 'unconfigured' : 'error', err.message);
        
        if (window.addLog) window.addLog(`Fallo de conexión: ${err.message}`, 'error');
    }
};
// Ejecutar una vez al cargar para limpiar el error reportado por el usuario
(async function fixNataliaTypo() {
    try {
        const emps = await window.TurnosDB.getEmpleados();
        window.empleadosGlobales = emps;
        const natalia = emps.find(e => e.nombre === 'Natalia' || e.id === 'Natalia');
        const natalio = emps.find(e => e.nombre === 'Natalio' || e.id === 'Natalio');
        
        if (natalia) {
            console.log("Corrigiendo typo Natalia -> Natalio en empleados...");
            await window.TurnosDB.upsertEmpleado({
                ...natalia,
                nombre: 'Natalio',
                id_interno: natalia.id_interno || natalia.id
            });
            
            // MIGRACIÓN DE EVENTOS: Renombrar en eventos donde aparezca como empleado o sustituto
            const events = await window.TurnosDB.fetchEventos("2024-01-01", "2026-12-31");
            const toUpdate = events.filter(ev => ev.empleado_id === 'Natalia' || ev.empleado_destino_id === 'Natalia');
            if (toUpdate.length > 0) {
                console.log(`Actualizando ${toUpdate.length} eventos de Natalia -> Natalio...`);
                for (const ev of toUpdate) {
                    const updated = { ...ev };
                    if (ev.empleado_id === 'Natalia') updated.empleado_id = 'Natalio';
                    if (ev.empleado_destino_id === 'Natalia') updated.empleado_destino_id = 'Natalio';
                    await window.TurnosDB.upsertEvento(updated);
                }
            }
        }
    } catch(e) { console.warn("Error en auto-fix Natalia:", e); }
})();

window.renderVacations = async () => {
    try {
    const area = $('#vacations-content');
    if (!area) return;
    area.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando vacaciones premium...</div>';
    
        const [employees, hotels] = await Promise.all([
            window.TurnosDB.getEmpleados(),
            window.TurnosDB.getHotels()
        ]);

        const hotel = $('#vacHotel')?.value || 'all';
        const emp = $('#vacEmp')?.value || 'all';
        const selectedYear = Number($('#vacYear')?.value || new Date().getFullYear());
        const status = $('#vacStatus')?.value || 'pending';
        const start = `${selectedYear}-01-01`;
        const end = `${selectedYear}-12-31`;
        const todayKey = new Date().toISOString().split('T')[0];

        // Fetch de eventos tipo VAC
        const eventos = await window.TurnosDB.fetchEventos(start, end);
        const ESTADO_EXCLUIDO = /^(anulad|rechazad|cancelad)/i;
        
        const vacEventos = eventos.filter(ev => 
            String(ev.tipo || '').toUpperCase().startsWith('VAC') && 
            !ESTADO_EXCLUIDO.test(ev.estado || '')
        );

        // Mapear a periodos
        const groupedVacs = window.groupConsecutiveEvents(vacEventos);
        const allPeriods = groupedVacs.map(ev => ({
            id:        ev.id,
            ids:       ev.ids || [ev.id],
            isGroup:   ev.isGroup || false,
            empId:     ev.empleado_id,
            hotel:     ev.hotel_origen || ev.payload?.hotel_id || 'General',
            start:     ev.fecha_inicio,
            end:       ev.fecha_fin || ev.fecha_inicio,
            days:      Math.max(1, Math.round((new Date((ev.fecha_fin || ev.fecha_inicio) + 'T12:00:00') - new Date(ev.fecha_inicio + 'T12:00:00')) / 86400000) + 1),
            sustituto: ev.empleado_destino_id || ev.payload?.sustituto || '',
            estado:    ev.estado || 'activo'
        }));

        // Filtrado local
        let visible = allPeriods.filter(p => {
            if (hotel !== 'all' && p.hotel !== hotel) return false;
            if (emp !== 'all' && p.empId !== emp) return false;
            if (status === 'pending') return p.end >= todayKey;
            if (status === 'past') return p.end < todayKey;
            return true;
        });
        visible.sort((a,b) => a.start.localeCompare(b.start));
        _visibleVacationPeriods = visible;

        // Renderizado de UI
        const years = [];
        const currentYear = new Date().getFullYear();
        for(let y=currentYear-1; y<=currentYear+2; y++) years.push(y);

        area.innerHTML = `
            <!-- ALTA FORM -->
            <section class="glass-panel" style="padding:12px 18px; margin-bottom:12px; border:1px solid var(--border); border-radius:12px;">
                <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
                    <h2 id="vacFormTitle" style="margin:0; font-size:1rem;">Alta de vacaciones</h2>
                    <div id="vacFormStatus" style="font-size:0.8rem;"></div>
                </div>
                <form id="vacCreateForm" style="display:grid; grid-template-columns:repeat(6, minmax(140px, 1fr)); gap:12px; align-items:end;" onsubmit="window.saveVacation(event)">
                    <label class="form-label-premium">Empleado
                        <select id="newVacEmp" class="btn-premium" required onchange="window.syncVacationFormHotel()"></select>
                    </label>
                    <label class="form-label-premium">Hotel
                        <select id="newVacHotel" class="btn-premium" required></select>
                    </label>
                    <label class="form-label-premium">Rango de Vacaciones
                        <input id="newVacRange" type="text" placeholder="Seleccionar periodo..." class="btn-premium" readonly style="width:240px; cursor:pointer;">
                        <input id="newVacStart" type="hidden">
                        <input id="newVacEnd" type="hidden">
                    </label>
                    <label class="form-label-premium">Sustituto
                        <select id="newVacSub" class="btn-premium"></select>
                    </label>
                    <div style="display:flex; gap:5px;">
                        <button id="btnCreateVac" class="btn-publish-premium" type="submit" style="flex:1; margin:0;">Guardar</button>
                        <button id="btnCancelEditVac" class="btn-premium" type="button" style="display:none; padding:10px;" onclick="window.resetVacationForm()">✖</button>
                    </div>
                </form>
            </section>

            <!-- FILTROS -->
            <section class="glass-panel" style="padding:10px 18px; margin-bottom:12px; border:1px solid var(--border); border-radius:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div>
                        <h2 style="margin:0; font-size:1rem;">Gestión anual de vacaciones</h2>
                    </div>
                    <div class="header-controls" style="display:flex; gap:8px;">
                        <select id="vacHotel" class="btn-premium" onchange="window.renderVacations()">
                            <option value="all">Todos los Hoteles</option>
                            ${hotels.map(h => `<option value="${h}" ${hotel === h ? 'selected' : ''}>${h}</option>`).join('')}
                        </select>
                        <select id="vacEmp" class="btn-premium" onchange="window.renderVacations()">
                            <option value="all">Todos los Empleados</option>
                            ${employees.map(e => `<option value="${e.id}" ${emp === e.id ? 'selected' : ''}>${e.nombre || e.id}</option>`).join('')}
                        </select>
                        <select id="vacYear" class="btn-premium" onchange="window.renderVacations()">
                            ${years.map(y => `<option value="${y}" ${selectedYear === y ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                        <select id="vacStatus" class="btn-premium" onchange="window.renderVacations()">
                            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pendientes</option>
                            <option value="past" ${status === 'past' ? 'selected' : ''}>Pasadas</option>
                            <option value="all" ${status === 'all' ? 'selected' : ''}>Todas</option>
                        </select>
                    </div>
                </div>
            </section>

            <!-- KPIs -->
            <div style="display:grid; grid-template-columns:repeat(3, minmax(180px, 1fr)); gap:12px; margin-bottom:14px;">
                <div class="glass-panel" style="padding:16px; border:1px solid var(--border); border-radius:15px;">
                    <div style="font-size:0.7rem; color:var(--text-dim); font-weight:800; text-transform:uppercase;">Periodos</div>
                    <div style="font-size:2rem; font-weight:900; margin-top:4px;">${visible.length}</div>
                </div>
                <div class="glass-panel" style="padding:16px; border:1px solid var(--border); border-radius:15px;">
                    <div style="font-size:0.7rem; color:var(--text-dim); font-weight:800; text-transform:uppercase;">Personas</div>
                    <div style="font-size:2rem; font-weight:900; margin-top:4px;">${new Set(visible.map(p => p.empId)).size}</div>
                </div>
                <div class="glass-panel" style="padding:16px; border:1px solid var(--border); border-radius:15px;">
                    <div style="font-size:0.7rem; color:var(--text-dim); font-weight:800; text-transform:uppercase;">Próxima salida</div>
                    <div style="font-size:1.15rem; font-weight:900; margin-top:8px;">${visible.length ? visible[0].empId : '—'}</div>
                </div>
            </div>

            <!-- TABLA -->
            <div class="glass-panel" style="padding:0; overflow:hidden; border-radius:15px; border:1px solid var(--border);">
                <table class="preview-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:var(--bg3);">
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Empleado</th>
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Hotel</th>
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Sustituto</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Estado</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Periodo / Duración</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visible.map((p, idx) => `
                            <tr style="border-top:1px solid var(--border);">
                                <td style="padding:1rem; font-weight:700; color:var(--accent);">${p.empId}</td>
                                <td style="padding:1rem; font-size:0.85rem;">${p.hotel}</td>
                                <td style="padding:1rem; font-size:0.85rem; color:var(--text-dim);">${p.sustituto || '—'}</td>
                                <td style="padding:1rem; text-align:center;">
                                    <span style="background:${p.end >= todayKey ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)'}; color:${p.end >= todayKey ? '#10b981' : 'var(--text-dim)'}; padding:4px 10px; border-radius:8px; font-weight:800; font-size:0.6rem;">
                                        ${p.end >= todayKey ? 'PENDIENTE' : 'PASADA'}
                                    </span>
                                </td>
                                <td style="padding:1rem; text-align:center;">
                                    <div style="font-weight:700;">${window.fmtDateLegacy(p.start)} — ${window.fmtDateLegacy(p.end)}</div>
                                    <div style="font-size:0.65rem; color:var(--text-dim); margin-top:4px; font-weight:700;">${Math.round((new Date(p.end + 'T12:00:00') - new Date(p.start + 'T12:00:00')) / 86400000) + 1} DÍAS</div>
                                </td>
                                <td style="padding:1rem; text-align:center;">
                                    <button class="btn-premium" onclick="window.editVacationByIndex(${idx})" style="padding:5px 10px; font-size:0.7rem;">Gestionar</button>
                                    <button class="btn-premium" onclick="window.cancelVacationGroup(${idx})" style="padding:5px 10px; font-size:0.7rem; color:var(--danger);">Anular</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Llenar selects del form
        const newVacEmp = $('#newVacEmp');
        const newVacHotel = $('#newVacHotel');
        const newVacSub = $('#newVacSub');
        if (newVacEmp) {
            newVacEmp.innerHTML = `<option value="" disabled selected>Seleccionar empleado...</option>` + 
                employees.map(e => `<option value="${e.id}">${e.nombre || e.id}</option>`).join('');
        }
        if (newVacHotel) {
            newVacHotel.innerHTML = `<option value="" disabled selected>Hotel...</option>` + 
                hotels.map(h => `<option value="${h}">${h}</option>`).join('');
        }
        window.syncVacationFormHotel();

        // Inicializar Flatpickr para el rango con estilo premium
        flatpickr("#newVacRange", {
            mode: "range",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/y",
            locale: "es",
            monthSelectorType: "static",
            animate: true,
            onClose: (selectedDates) => {
                if (selectedDates.length === 2) {
                    $('#newVacStart').value = window.isoDate(selectedDates[0]);
                    $('#newVacEnd').value = window.isoDate(selectedDates[1]);
                } else {
                    $('#newVacStart').value = "";
                    $('#newVacEnd').value = "";
                }
            }
        });

    } catch (e) { 
        console.error(e);
        area.innerHTML = '<div style="color:var(--danger); padding:2rem;">Error: ' + e.message + '</div>'; 
    }
};

window.syncVacationFormHotel = async () => {
    const empId = $('#newVacEmp')?.value;
    if (!empId) return;
    const emps = await window.TurnosDB.getEmpleados();
    const profile = emps.find(e => e.id === empId);
    if (profile?.hotel_id && $('#newVacHotel')) $('#newVacHotel').value = profile.hotel_id;

    const subSelect = $('#newVacSub');
    if (subSelect) {
        subSelect.innerHTML = `<option value="">Sin sustituto asignado</option>` + 
            emps.filter(e => e.id !== empId).map(e => `<option value="${e.id}">${e.nombre || e.id}</option>`).join('');
    }
};

window.saveVacation = async (e) => {
    e.preventDefault();
    const btn = $('#btnCreateVac');
    const form = $('#vacCreateForm');
    const statusBox = $('#vacFormStatus');
    
    try {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        
        const payload = {
            tipo: 'VAC',
            empleado_id: $('#newVacEmp').value,
            hotel_origen: $('#newVacHotel').value,
            fecha_inicio: $('#newVacStart').value,
            fecha_fin: $('#newVacEnd').value,
            empleado_destino_id: $('#newVacSub').value || null,
            estado: 'activo'
        };

        if (!payload.fecha_inicio || !payload.fecha_fin) {
            alert("Por favor, selecciona un rango de fechas válido en el calendario.");
            return;
        }

        if (_editingVacationPeriod?.id) {
            await window.TurnosDB.anularEvento(_editingVacationPeriod.id);
        }

        await window.TurnosDB.upsertEvento(payload);
        
        statusBox.innerHTML = '<span style="color:#10b981;">✓ Vacaciones guardadas</span>';
        window.resetVacationForm();
        await window.renderVacations();

        // --- BLOQUE E: ACCIONES RÁPIDAS ---
        const quickActions = $('#dashboard-quick-actions');
        if (quickActions) {
            quickActions.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:15px;">
                    <button class="btn-premium" onclick="window.switchSection('excel')" style="height:100px; flex-direction:column; gap:8px;"><i class="fas fa-file-excel fa-2x"></i><span>Gestión Excel</span></button>
                    <button class="btn-premium" onclick="window.switchSection('preview')" style="height:100px; flex-direction:column; gap:8px;"><i class="fas fa-calendar-alt fa-2x"></i><span>Vista Previa</span></button>
                    <button class="btn-premium" onclick="window.switchSection('employees')" style="height:100px; flex-direction:column; gap:8px;"><i class="fas fa-users fa-2x"></i><span>Empleados</span></button>
                    <button class="btn-premium" onclick="window.open('https://cumbriaspahotel.github.io/Turnos-new/', '_blank', 'noopener,noreferrer')" style="height:100px; flex-direction:column; gap:8px; background:var(--accent); color:white;"><i class="fas fa-external-link-alt fa-2x"></i><span>Vista Pública</span></button>
                </div>
            `;
        }
    } catch (err) {
        statusBox.innerHTML = `<span style="color:var(--danger);">Error: ${err.message}</span>`;
    } finally {
        btn.disabled = false;
        btn.textContent = _editingVacationPeriod ? 'Actualizar' : 'Guardar';
    }
};

window.editVacationByIndex = async (idx) => {
    const p = _visibleVacationPeriods[idx];
    if (!p) return;
    _editingVacationPeriod = p;
    
    $('#newVacEmp').value = p.empId;
    await window.syncVacationFormHotel(); // Esperar a que se cargue el select de sustitutos
    
    $('#newVacHotel').value = p.hotel;
    $('#newVacStart').value = p.start;
    $('#newVacEnd').value = p.end;
    $('#newVacSub').value = p.sustituto || '';
    
    // Sincronizar Flatpickr
    const fp = document.querySelector("#newVacRange")._flatpickr;
    if (fp) fp.setDate([p.start, p.end]);
    
    $('#vacFormTitle').textContent = `Editando vacaciones de ${p.empId}`;
    $('#btnCreateVac').textContent = 'Actualizar';
    $('#btnCancelEditVac').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetVacationForm = () => {
    _editingVacationPeriod = null;
    $('#vacCreateForm')?.reset();
    $('#vacFormTitle').textContent = 'Alta de vacaciones';
    $('#btnCreateVac').textContent = 'Guardar';
    $('#btnCancelEditVac').style.display = 'none';
};

window.cancelVacationByIndex = async (idx) => {
    const p = _visibleVacationPeriods[idx];
    if (!p || !confirm(`¿Anular las vacaciones de ${p.empId}?`)) return;
    try {
        if (p.id) await window.TurnosDB.anularEvento(p.id);
        else await window.TurnosDB.deleteVacacionesPeriodo({ empleado_id: p.empId, fecha_inicio: p.start, fecha_fin: p.end });
        await window.renderVacations();
    } catch (e) { alert('Error: ' + e.message); }
};

// --- BAJAS ---

window.renderBajas = async () => {
    try {
    const area = $('#absences-content');
    if (!area) return;
    area.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando ausencias premium...</div>';
    
        const hotel  = $('#bjHotel')?.value  || 'all';
        const emp    = $('#bjEmp')?.value    || 'all';
        const status = $('#bjStatus')?.value || 'all';
        const range  = $('#bjRange')?.value  || '';
        
        const now = new Date();
        const isoNow = window.isoDate(now);

        let start = null, end = null;
        if (range.includes(' a ')) [start, end] = range.split(' a ');
        
        // POR DEFECTO: SI NO HAY RANGO, MOSTRAR DESDE HOY
        if (!range && status === 'all') {
            start = isoNow;
        }

        let rawData = await window.TurnosDB.fetchBajasPermisos({
            hotel: hotel !== 'all' ? hotel : null,
            empleado: emp !== 'all' ? emp : null,
            estadoFiltro: status,
            fechaInicio: start,
            fechaFin: end
        });
        const data = window.groupConsecutiveEvents(rawData);

        // Llenar filtros del header si existen
        const hotelSelect = $('#bjHotel');
        const empSelect = $('#bjEmp');
        if (hotelSelect && empSelect && hotelSelect.options.length <= 1) {
            const [hotels, employees] = await Promise.all([window.TurnosDB.getHotels(), window.TurnosDB.getEmpleados()]);
            hotelSelect.innerHTML = `<option value="all">Todos los Hoteles</option>` + hotels.map(h => `<option value="${h}">${h}</option>`).join('');
            empSelect.innerHTML = `<option value="all">Todos los Empleados</option>` + employees.map(e => `<option value="${e.id}">${e.nombre || e.id}</option>`).join('');

            // Init flatpickr for range
            if (window.flatpickr) {
                window.flatpickr("#bjRange", {
                    mode: "range", dateFormat: "Y-m-d",
                    locale: "es",
                    onChange: () => window.renderBajas()
                });
            }
        }

        if (data.length === 0) {
            area.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;">No hay registros de bajas o permisos.</div>';
            return;
        }

        data.sort((a,b) => b.fecha_inicio.localeCompare(a.fecha_inicio));

        area.innerHTML = `
            <div class="glass-panel" style="padding:0; overflow:hidden; border-radius:15px; border:1px solid var(--border);">
                <table class="preview-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:var(--bg3);">
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Tipo</th>
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Empleado</th>
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Hotel</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Periodo</th>
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Sustituto</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Estado</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(b => `
                            <tr style="border-top:1px solid var(--border);">
                                <td style="padding:1rem;">
                                    <span style="background:${b.tipo.includes('BAJA') ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)'}; color:${b.tipo.includes('BAJA') ? '#f87171' : '#a78bfa'}; padding:4px 10px; border-radius:8px; font-weight:800; font-size:0.6rem;">
                                        ${b.tipo}
                                    </span>
                                </td>
                                <td style="padding:1rem; font-weight:700;">${b.empleado_id}</td>
                                <td style="padding:1rem; font-size:0.85rem; color:var(--text-dim);">${b.hotel_origen || 'General'}</td>
                                <td style="padding:1rem; text-align:center;">
                                    <div style="font-weight:600;">${window.fmtDateLegacy(b.fecha_inicio)} — ${window.fmtDateLegacy(b.fecha_fin || b.fecha_inicio)}</div>
                                    <div style="font-size:0.65rem; color:var(--text-dim); margin-top:4px; font-weight:700;">${Math.round((new Date((b.fecha_fin || b.fecha_inicio) + 'T12:00:00') - new Date(b.fecha_inicio + 'T12:00:00')) / 86400000) + 1} DÍAS ${b.isGroup ? '(Agrupados)' : 'NATURALES'}</div>
                                </td>
                                <td style="padding:1rem; font-size:0.85rem;">${b.empleado_destino_id || '—'}</td>
                                <td style="padding:1rem; text-align:center;">
                                    <span style="background:${b.estado === 'anulado' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; color:${b.estado === 'anulado' ? '#ef4444' : '#10b981'}; padding:4px 10px; border-radius:8px; font-weight:800; font-size:0.6rem;">
                                        ${(b.estado || 'activo').toUpperCase()}
                                    </span>
                                </td>
                                <td style="padding:1rem; text-align:center;">
                                    <button class="btn-premium" onclick="window.manageBajaGroup('${b.id}', ${JSON.stringify(b.ids || [b.id])})" style="padding:5px 10px; font-size:0.7rem;">Gestionar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) { area.innerHTML = '<div style="color:red; padding:2rem;">Error: ' + e.message + '</div>'; }
};

window.editBajaPeriod = async (id) => {
    try {
        const data = await window.TurnosDB.fetchEventos(); // Usamos fetchEventos general para máxima compatibilidad
        const match = data.find(b => String(b.id) === String(id));
        if (!match) return alert('No se encontró el registro: ' + id);

        _editingBajaData = match;
        $('#modalTitle').innerText = 'Gestionar Baja / Permiso';
        $('#btnDeleteBaja').style.display = 'block';

        // Llenar empleados y hoteles si no están listos
        const [hotels, emps] = await Promise.all([window.TurnosDB.getHotels(), window.TurnosDB.getEmpleados()]);
        $('#mbHotel').innerHTML = `<option value="" disabled>Seleccionar hotel...</option>` + hotels.map(h => `<option value="${h}" ${h === match.hotel_origen ? 'selected' : ''}>${h}</option>`).join('');
        $('#mbEmp').innerHTML = `<option value="" disabled>Seleccionar empleado...</option>` + emps.map(e => `<option value="${e.id}" ${e.id === match.empleado_id ? 'selected' : ''}>${e.nombre || e.id}</option>`).join('');
        $('#mbSustituto').innerHTML = `<option value="">Sin sustituto asignado</option>` + emps.map(e => `<option value="${e.id}" ${e.id === match.empleado_destino_id ? 'selected' : ''}>${e.nombre || e.id}</option>`).join('');

        $('#mbTipo').value = match.tipo;
        $('#mbDateStart').value = match.fecha_inicio;
        $('#mbDateEnd').value = match.fecha_fin || match.fecha_inicio;
        $('#mbObs').value = match.observaciones || '';

        $('#modalBaja').style.display = 'flex';
    } catch (err) {
        alert('Error al cargar registro: ' + err.message);
    }
};

window.deleteCurrentPeriod = async () => {
    if (!_editingBajaData?.id) return;
    if (!confirm('¿Seguro que deseas eliminar permanentemente este registro?')) return;
    
    const btn = $('#btnDeleteBaja');
    try {
        btn.disabled = true;
        btn.textContent = 'Eliminando...';
        await window.TurnosDB.anularEvento(_editingBajaData.id);
        window.closeBajaPermisoModal();
        await window.renderBajas();
    } catch (e) { 
        alert('Error: ' + e.message); 
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Eliminar este registro';
        }
    }
};
// ==========================================
// 1. N�aCLEO Y CONFIGURACI�N GLOBAL
// ==========================================
window.parsedData = null;
// (Utilidades movidas al inicio del archivo)

window.cleanLogText = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

window.DEBUG_MODE = false;

// --- NAVEGACIÓN ---
window.switchSection = (id) => {
    // Alias de navegación
    const aliases = {
        'control': 'home', 'panel-control': 'home', 'dashboard': 'home',
        'gestion-excel': 'excel',
        'vista-previa': 'preview',
        'empleados': 'employees',
        'cambios-turno': 'changes',
        'vacaciones': 'vacations',
        'bajas-permisos': 'bajas', 'leaves': 'bajas',
        'solicitudes': 'requests',
        'configuracion': 'config', 'settings': 'config'
    };
    const targetId = aliases[id] || id;

    console.log(`[NAV] Cambiando a sección: ${targetId} (original: ${id})`);
    const sections = document.querySelectorAll('.section');
    const menuItems = document.querySelectorAll('.menu-item');
    
    sections.forEach(s => s.classList.remove('active'));
    menuItems.forEach(m => m.classList.remove('active'));

    const targetSec = document.getElementById(`section-${targetId}`);
    if (targetSec) {
        targetSec.classList.add('active');
    } else {
        console.warn(`[NAV] Sección section-${targetId} no encontrada en el DOM`);
    }

    // Activar el botón correspondiente en el sidebar
    const targetBtn = Array.from(menuItems).find(m => {
        const onClick = m.getAttribute('onclick') || '';
        return onClick.includes(`'${id}'`) || onClick.includes(`"${id}"`) || onClick.includes(`'${targetId}'`) || onClick.includes(`"${targetId}"`);
    });
    if (targetBtn) targetBtn.classList.add('active');

    if (targetId === 'home') window.renderDashboard?.();
    if (targetId === 'excel') window.renderExcelView?.();
    if (targetId === 'preview') window.renderPreview?.();
    if (targetId === 'employees') window.populateEmployees?.();
    if (targetId === 'changes') window.renderChanges?.();
    if (targetId === 'requests') window.renderRequests?.();
    if (targetId === 'vacations') window.renderVacations?.();
    if (targetId === 'bajas') window.renderBajas?.();
};

/**
 * Navegación inteligente desde el Dashboard a puntos específicos de conflicto.
 */
window.goToOperationalIssue = (empId, date, type) => {
    console.log(`[NAVEGACIÓN] Dirigiendo a: ${empId}, Fecha: ${date}, Tipo: ${type}`);
    
    if (type === 'SIN_ID_INTERNO' || type === 'PLAZA_PENDIENTE') {
        // Problemas de base de datos -> Ir al Excel
        window.goToExcelRecord(empId, date);
    } else if (date) {
        // Problemas operativos puntuales -> Ir a la Vista Previa (Calendario)
        window.goToPreviewRecord(empId, date);
    } else {
        // Problemas de perfil -> Ir a Empleados y abrir ficha
        window.switchSection('employees');
        window.openEmpDrawer(empId);
    }
};

window.goToExcelRecord = (empId, date) => {
    window.switchSection('excel');
    window.excelFilters = window.excelFilters || {};
    window.excelFilters.search = empId === '¿?' ? '' : empId; // No filtramos por '¿?' para ver el contexto
    if (date) {
        const month = date.slice(0, 7);
        const monthInput = document.getElementById('excelMonth');
        if (monthInput) monthInput.value = month;
    }
    window.renderExcelView();
    
    setTimeout(() => {
        const rows = document.querySelectorAll('.excel-row-hover');
        for (const row of rows) {
            if (row.textContent.includes(empId)) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.transition = 'background 0.5s';
                row.style.background = '#fef3c7';
                setTimeout(() => row.style.background = '', 3000);
                break;
            }
        }
    }, 600);
};

window.goToPreviewRecord = (empId, date) => {
    window.switchSection('preview');
    if (date) {
        const monday = window.getWeekStartISO(date);
        const input = document.getElementById('datePicker');
        if (input) {
            input.value = monday;
            // Si flatpickr está activo, actualizarlo
            if (input._flatpickr) input._flatpickr.setDate(monday);
        }
    }
    window.renderPreview();
    
    setTimeout(() => {
        const empRows = document.querySelectorAll('.employee-row-header, .puesto-row-header');
        let found = false;
        for (const row of empRows) {
             if (row.textContent.toLowerCase().includes(empId.toLowerCase())) {
                 row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 const container = row.closest('.preview-row') || row.parentElement;
                 container.style.transition = 'outline 0.3s';
                 container.style.outline = '4px solid #3b82f6';
                 container.style.outlineOffset = '-4px';
                 container.style.borderRadius = '12px';
                 container.style.zIndex = '10';
                 setTimeout(() => {
                     container.style.outline = 'none';
                 }, 5000);
                 found = true;
                 break;
             }
        }
        if (!found) console.warn(`[NAVEGACIÓN] No se encontró la fila para ${empId} en Vista Previa`);
    }, 1200);
};
// ==========================================
// MÓDULO: MODO EXCEL (RESTAURADO)
// ==========================================
window.renderExcelView = async () => {
    try {
    const container = $('#excel-grid-container');
    if (!container) return;

    // Asegurar carga del mapa de orden V9
    await window.loadV9ExcelOrderMap();
    
    const oldHotelSelect = $('#excelHotel');
    const oldDateStart = $('#excelDateStart')?.value;
    const oldDateEnd = $('#excelDateEnd')?.value;
    const selectedHotel = oldHotelSelect?.value || 'all';

    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-dim);"><i class="fas fa-spinner fa-spin"></i> Cargando Excel base...</div>';
    
        let dateStart = oldDateStart;
        let dateEnd = oldDateEnd;
        if (!dateStart || !dateEnd) {
            const now = new Date();
            dateStart = window.isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
            dateEnd = window.isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        }

        const wStartStr = window.getWeekStartISO(dateStart);
        const wEndStr = window.isoDate(new Date(new Date(dateEnd + 'T12:00:00').getTime() + 7 * 86400000));
        
        let dbHotels = await window.getAvailableHotels();
        const rawData = await window.TurnosDB.fetchTurnosBase(wStartStr, wEndStr, selectedHotel === 'all' ? null : selectedHotel);
        
        if (!window.excelFilters) window.excelFilters = { search: '', onlyPending: false };
        // Helper: valid internal ID
        const _hasValidId = (empId) => {
            const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empId) || window.normalizeId(e.nombre) === window.normalizeId(empId));
            const idInt = String(profile?.id_interno || '').trim();
            return /^EMP-\d{4,}$/.test(idInt);
        };
        if (window.pendingChangesCount === undefined) window.pendingChangesCount = 0;
        
        const getEmpLabel = (empId) => {
            if (!empId) return 'Desconocido';
            const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empId) || window.normalizeId(e.nombre) === window.normalizeId(empId));
            if (!profile) return `${empId} [${empId}]`;
            const idInt = profile.id_interno || profile.id || empId;
            return `${profile.nombre || empId} [${idInt}]`;
        };
        const TURNO_MAP = { 'M': 'Mañana', 'Mañana': 'Mañana', 'T': 'Tarde', 'Tarde': 'Tarde', 'N': 'Noche', 'Noche': 'Noche', 'D': 'Descanso', 'Descanso': 'Descanso', '-': 'Pendiente de asignar', '—': 'Pendiente de asignar', '': 'Pendiente de asignar', null: 'Pendiente de asignar' };
        let totalPendientes = 0;
        let totalSupportPendientes = 0;
        let totalNoId = 0;
        // PHASE 1: Group WITHOUT employee filter — to compute available employees
        const grouped = {};
        // Pre-compute support staff set for fast lookup
        const _supportStaffSet = new Set();
        (window.empleadosGlobales || []).forEach(emp => {
            if (window.isEmpleadoOcasionalOApoyo && window.isEmpleadoOcasionalOApoyo(emp)) {
                _supportStaffSet.add(window.normalizeId(emp.id));
                if (emp.nombre) _supportStaffSet.add(window.normalizeId(emp.nombre));
            }
        });
        const _isSupport = (empId) => _supportStaffSet.has(window.normalizeId(empId));
        // Pre-compute no-ID set
        const _noIdSet = new Set();

        rawData.forEach(record => {
            const empId = record.empleado_id || 'Desconocido';
            if (empId.startsWith('_DUP') || empId.startsWith('Test_') || empId.startsWith('test_')) return;
            const h = record.hotel_id || 'Sin Hotel';
            if (selectedHotel !== 'all' && h !== selectedHotel) return;
            const wStart = window.getWeekStartISO(record.fecha);
            const val = record.turno || '—';
            const isPending = (val === '—' || val === '-' || !val);
            const isSupport = _isSupport(empId);
            const hasId = _hasValidId(empId);
            if (!hasId) _noIdSet.add(empId);
            // Count pendientes within selected date range
            if (isPending && record.fecha >= dateStart && record.fecha <= dateEnd) {
                if (!hasId) { totalNoId++; }
                else if (isSupport) { totalSupportPendientes++; }
                else { totalPendientes++; }
            }
            if (!grouped[h]) grouped[h] = {};
            if (!grouped[h][wStart]) grouped[h][wStart] = {};
            if (!grouped[h][wStart][empId]) grouped[h][wStart][empId] = { values: Array(7).fill('—'), hasPending: false, hasSupportPending: false, isSupport, hasValidId: hasId };
            const offset = window.getDayOffsetFromWeek(wStart, record.fecha);
            if (offset >= 0 && offset <= 6) {
                grouped[h][wStart][empId].values[offset] = val;
                if (isPending && !isSupport) grouped[h][wStart][empId].hasPending = true;
                if (isPending && isSupport && hasId) grouped[h][wStart][empId].hasSupportPending = true;
            }
        });
        // Apply onlyPending filter to grouped (for available employee computation)
        if (window.excelFilters.onlyPending) {
            Object.keys(grouped).forEach(h => {
                Object.keys(grouped[h]).forEach(w => {
                    Object.keys(grouped[h][w]).forEach(e => { if (!grouped[h][w][e].hasPending) delete grouped[h][w][e]; });
                    if (Object.keys(grouped[h][w]).length === 0) delete grouped[h][w];
                });
                if (Object.keys(grouped[h]).length === 0) delete grouped[h];
            });
        }
        // PHASE 2: Compute available employees from primary-filtered data (within period)
        const _availableExcelEmps = new Set();
        Object.entries(grouped).forEach(([h, hotelData]) => {
            Object.entries(hotelData).forEach(([wStart, weekData]) => {
                // Only count weeks that intersect the user's selected period
                const wEndDate = new Date(wStart + 'T12:00:00');
                wEndDate.setDate(wEndDate.getDate() + 6);
                const wEnd = window.isoDate(wEndDate);
                if (wStart > dateEnd || wEnd < dateStart) return;
                Object.keys(weekData).forEach(empId => _availableExcelEmps.add(empId));
            });
        });
        // Reset selection if employee no longer in filtered set
        if (window.excelFilters.search && !_availableExcelEmps.has(window.excelFilters.search)) {
            window.excelFilters.search = '';
        }
        // PHASE 3: Apply employee filter to grouped for table rendering
        if (window.excelFilters.search) {
            const selEmp = window.excelFilters.search;
            Object.keys(grouped).forEach(h => {
                Object.keys(grouped[h]).forEach(w => {
                    Object.keys(grouped[h][w]).forEach(e => {
                        if (window.normalizeId(e) !== window.normalizeId(selEmp)) delete grouped[h][w][e];
                    });
                    if (Object.keys(grouped[h][w]).length === 0) delete grouped[h][w];
                });
                if (Object.keys(grouped[h]).length === 0) delete grouped[h];
            });
        }
        const hotelsToRender = selectedHotel === 'all' ? dbHotels : [selectedHotel];
        const saveBtnActive = window.pendingChangesCount > 0;
        container.innerHTML = `
            <div class="excel-toolbar">
                <div class="toolbar-group"><label>Hotel</label><select id="excelHotel" class="toolbar-input" onchange="window.renderExcelView()"><option value="all">Ver Todos</option>${dbHotels.map(h => `<option value="${h}" ${h === selectedHotel ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
                <div class="toolbar-group">
                    <label>Periodo</label>
                    <input type="text" id="excelRangePicker" class="toolbar-input" placeholder="Seleccionar periodo..." readonly style="width:220px; cursor:pointer;">
                    <input type="hidden" id="excelDateStart" value="${dateStart}">
                    <input type="hidden" id="excelDateEnd" value="${dateEnd}">
                </div>
                <div class="toolbar-group">
                    <label>Empleado / ID</label>
                    <select id="excelSearch" class="toolbar-input" onchange="window.excelFilters.search=this.value; window.renderExcelView()">
                        <option value="">Ver Todos los Empleados</option>
                        ${(() => {
                            // Use pre-computed _availableExcelEmps from Phase 2 (before employee filter)
                            const empProfiles = Array.from(_availableExcelEmps)
                                .map(id => {
                                    const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(id) || window.normalizeId(e.nombre) === window.normalizeId(id));
                                    return { id, nombre: profile?.nombre || id, id_interno: profile?.id_interno || id, isDup: id.includes('_DUP'), hasValidId: _hasValidId(id) };
                                })
                                .filter(e => !e.isDup && e.hasValidId)
                                .sort((a,b) => (a.nombre || '').localeCompare(b.nombre || ''));
                            if (empProfiles.length === 0) return '<option value="" disabled>Sin empleados para este filtro</option>';
                            return empProfiles.map(e => `<option value="${e.id}" ${window.excelFilters.search === e.id ? 'selected' : ''}>${e.nombre} [${e.id_interno}]</option>`).join('');
                        })()}
                    </select>
                </div>
                <div class="toolbar-group"><label>Filtro Rápido</label><label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.8rem; text-transform:none; color:#1e293b; font-weight:600;"><input type="checkbox" id="excelOnlyPending" ${window.excelFilters.onlyPending ? 'checked' : ''} onchange="window.excelFilters.onlyPending=this.checked; window.renderExcelView()"> Solo Pendientes</label></div>
                <div class="toolbar-group" style="margin-left:auto; text-align:right;"><label>Pendientes</label><div style="font-weight:900; color:#b91c1c; font-size:1.1rem;"><span id="excelCounter">${totalPendientes}</span></div>${totalSupportPendientes > 0 ? `<div style="font-size:0.7rem; color:#64748b; font-weight:500;">Apoyo: ${totalSupportPendientes}</div>` : ''}${_noIdSet.size > 0 ? `<div style="font-size:0.65rem; color:#ef4444; font-weight:500;">Sin ID: ${_noIdSet.size} emp.</div>` : ''}</div>
                <button class="btn-premium" onclick="window.openRefuerzoModal()" style="padding:10px 18px; font-size:0.75rem; font-weight:700; white-space:nowrap; background:linear-gradient(135deg,#3b82f6,#2563eb); color:white; border:none; border-radius:12px; cursor:pointer;"><i class="fas fa-user-plus"></i> Añadir refuerzo</button>
                <button id="btnGuardarBase" class="btn-save-base ${saveBtnActive ? 'active' : ''}" ${!saveBtnActive ? 'disabled' : ''} onclick="window.saveTurnosBaseDirect()" title="${!saveBtnActive ? 'No hay cambios pendientes' : 'Guardar todos los cambios realizados'}"><i class="fas fa-save"></i> ${saveBtnActive ? `Guardar cambios (${window.pendingChangesCount})` : 'Guardar base'}</button>
            </div>
        `;
        const sections = hotelsToRender.map(hotel => {
            const hotelData = grouped[hotel];
            if (!hotelData) return '';
            const rows = [];
            Object.keys(hotelData).sort().forEach(wStart => {
                // Filter: only show weeks that intersect the user's selected period
                const wEndDate = new Date(wStart + 'T12:00:00');
                wEndDate.setDate(wEndDate.getDate() + 6);
                const wEnd = window.isoDate(wEndDate);
                if (wStart > dateEnd || wEnd < dateStart) return; // no intersection
                Object.keys(hotelData[wStart]).sort((a, b) => {
                    const orderA = window.getV9ExcelOrder(hotel, wStart, a) || 999999;
                    const orderB = window.getV9ExcelOrder(hotel, wStart, b) || 999999;
                    if (orderA !== orderB) return orderA - orderB;
                    return a.localeCompare(b);
                }).forEach(emp => {
                    const entry = hotelData[wStart][emp];
                    // Exclude employees without valid ID from operational view
                    if (!entry.hasValidId) return;
                    rows.push({ weekStart: wStart, empId: emp, displayName: getEmpLabel(emp), values: entry.values, hotel: hotel, isSupport: entry.isSupport, hasValidId: entry.hasValidId });
                });
            });
            if (rows.length === 0) return '';
            return `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; margin-bottom:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="padding:16px 20px; font-weight:800; color:#1e293b; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between;"><span>${hotel}</span><span style="font-size:0.7rem; color:#64748b; font-weight:600;">MOSTRANDO ${rows.length} FILAS</span></div>
                    <div style="overflow:auto;"><table style="width:100%; border-collapse:collapse; min-width:980px;"><thead><tr style="background:#f8fafc;"><th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:left; font-size:0.7rem; color:#64748b; text-transform:uppercase;">Semana</th><th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:left; font-size:0.7rem; color:#64748b; text-transform:uppercase;">Empleado</th>${['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map(day => `<th style="padding:12px 8px; border-bottom:1px solid #e2e8f0; text-align:center; font-size:0.7rem; color:#64748b;">${day}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `
                                    <tr class="excel-row-hover"><td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap; color:#64748b; font-size:0.8rem;">${window.fmtDateLegacy(row.weekStart)}</td><td style="padding:12px; border-bottom:1px solid #f1f5f9; min-width:220px; font-weight:600; color:#334155; font-size:0.85rem;">${row.displayName}</td>${[0, 1, 2, 3, 4, 5, 6].map(offset => {
                                            const dbVal = row.values[offset];
                                            const mappedVal = TURNO_MAP[dbVal] || dbVal;
                                            const isPendiente = (mappedVal === 'Pendiente de asignar');
                                            const pendClass = isPendiente ? (row.isSupport ? 'turno-pendiente-soft' : 'turno-pendiente-alerta') : '';
                                            const options = ['Pendiente de asignar', 'Mañana', 'Tarde', 'Noche', 'Descanso'].map(o => `<option value="${o}" ${o === mappedVal ? 'selected' : ''}>${o}</option>`).join('');
                                            const currDate = new Date(row.weekStart); currDate.setDate(currDate.getDate() + offset);
                                            const dStr = window.isoDate(currDate);
                                            return `<td style="padding:6px; border-bottom:1px solid #f1f5f9; text-align:center;"><select class="turno-edit-select ${pendClass}" data-hotel="${row.hotel}" data-emp="${row.empId}" data-date="${dStr}" data-original="${dbVal}" style="width:110px; padding:6px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; text-align:center; color:#475569; font-size:0.8rem; cursor:pointer;" onchange="window.handleExcelCellChange(this)">${options}</select></td>`;
                                        }).join('')}</tr>`).join('')}</tbody></table></div></div>`;
        }).join('');
        container.innerHTML += sections || '<div style="padding: 3rem; text-align: center; color: #94a3b8; font-weight:600;">No hay registros que coincidan con los filtros.</div>';

        // Inicializar Flatpickr para el rango Excel
        flatpickr("#excelRangePicker", {
            mode: "range",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/y",
            locale: "es",
            defaultDate: [dateStart, dateEnd],
            onClose: (selectedDates) => {
                if (selectedDates.length === 2) {
                    $('#excelDateStart').value = window.isoDate(selectedDates[0]);
                    $('#excelDateEnd').value = window.isoDate(selectedDates[1]);
                    window.renderExcelView();
                }
            }
        });
    } catch (error) { container.innerHTML = `<div style="padding:2rem; color:red; font-weight:800;">Error cargando Modo Excel: ${error.message}</div>`; }
};

window.handleExcelCellChange = (sel) => {
    const isPendiente = sel.value === 'Pendiente de asignar';
    // Preserve soft class for support staff
    if (sel.classList.contains('turno-pendiente-soft')) {
        sel.classList.toggle('turno-pendiente-soft', isPendiente);
    } else {
        sel.classList.toggle('turno-pendiente-alerta', isPendiente);
    }
    const selects = document.querySelectorAll('.turno-edit-select');
    let changes = 0;
    const REVERSE_MAP = { 'Mañana': 'M', 'Tarde': 'T', 'Noche': 'N', 'Descanso': 'D', 'Pendiente de asignar': '—' };
    selects.forEach(s => {
        const currentDb = REVERSE_MAP[s.value] || s.value;
        if (s.dataset.original !== currentDb) changes++;
    });
    window.pendingChangesCount = changes;
    const btn = document.getElementById('btnGuardarBase');
    if (btn) {
        btn.disabled = changes === 0;
        btn.classList.toggle('active', changes > 0);
        btn.innerHTML = `<i class="fas fa-save"></i> ${changes > 0 ? `Guardar cambios (${changes})` : 'Guardar base'}`;
    }
};

window.saveTurnosBaseDirect = async () => {
    const btn = document.getElementById('btnGuardarBase');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; }
    try {
        const selects = document.querySelectorAll('select.turno-edit-select');
        const updates = [];
        const blocked = [];
        const REVERSE_MAP = { 'Mañana': 'M', 'Tarde': 'T', 'Noche': 'N', 'Descanso': 'D', 'Pendiente de asignar': '—' };
        selects.forEach(sel => {
            const original = sel.dataset.original;
            const currentDb = REVERSE_MAP[sel.value] || sel.value;
            if (original !== currentDb) {
                const empId = sel.dataset.emp;
                // Validate: employee must have valid internal ID
                const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empId) || window.normalizeId(e.nombre) === window.normalizeId(empId));
                const idInt = String(profile?.id_interno || '').trim();
                if (!/^EMP-\d{4,}$/.test(idInt)) {
                    blocked.push(profile?.nombre || empId);
                    return;
                }
                updates.push({ hotel_id: sel.dataset.hotel, empleado_id: empId, fecha: sel.dataset.date, turno: currentDb, updated_by: 'ADMIN_EXCEL_VIEW' });
            }
        });
        if (blocked.length > 0) {
            alert(`⚠️ No se pueden guardar turnos para empleados sin ID interno válido:\n${blocked.join(', ')}`);
        }
        if (updates.length === 0) {
            alert('No hay cambios que guardar.');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar base'; }
            return;
        }
        const { error } = await window.supabase.from('turnos').upsert(updates, { onConflict: 'empleado_id,fecha' });
        if (error) throw error;
        window.pendingChangesCount = 0;
        alert('✅ Cambios base guardados correctamente.');
        await window.renderExcelView();
    } catch (err) {
        console.error(err);
        alert('❌ Error al guardar: ' + err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar cambios'; }
    }
};

// ==========================================
// MÓDULO: AÑADIR REFUERZO (MODAL OPERATIVO)
// ==========================================
window.openRefuerzoModal = async () => {
    const m = document.getElementById('modalRefuerzo');
    if (!m) return;
    const status = document.getElementById('refuerzoStatus');
    const warn = document.getElementById('refuerzoWarning');
    if (status) status.innerHTML = '';
    if (warn) { warn.style.display = 'none'; warn.textContent = ''; }

    const [hotels, emps] = await Promise.all([window.getAvailableHotels(), window.TurnosDB.getEmpleados()]);
    const selectedHotel = document.getElementById('excelHotel')?.value || 'all';

    // Hotel select — pre-select current Excel filter
    const rfHotel = document.getElementById('rfHotel');
    if (rfHotel) {
        rfHotel.innerHTML = hotels.map(h => `<option value="${h}"${h === selectedHotel && selectedHotel !== 'all' ? ' selected' : ''}>${h}</option>`).join('');
    }

    // Employee select — only structural support/ocasional staff with valid EMP-XXXX IDs
    const rfEmp = document.getElementById('rfEmp');
    if (rfEmp) {
        const supportEmps = emps
            .filter(e => {
                const idInt = String(e.id_interno || '').trim();
                if (!/^EMP-\d{4,}$/.test(idInt)) return false;
                if (window.isEmpleadoOcasionalOApoyo && window.isEmpleadoOcasionalOApoyo(e)) return true;
                return false;
            })
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        if (supportEmps.length === 0) {
            rfEmp.innerHTML = '<option value="" disabled selected>No hay empleados de apoyo con ID válido</option>';
        } else {
            rfEmp.innerHTML = '<option value="" disabled selected>Seleccionar empleado...</option>' +
                supportEmps.map(e => `<option value="${e.id}">${e.nombre || e.id} [${e.id_interno}]</option>`).join('');
        }
    }

    // Default date from Excel period
    const ds = document.getElementById('excelDateStart')?.value || '';
    const rfDateStart = document.getElementById('rfDateStart');
    if (rfDateStart) rfDateStart.value = ds;

    // Reset state
    document.getElementById('rfDateEnd').value = '';
    document.getElementById('rfTurno').value = '—';
    document.getElementById('rfObs').value = '';
    document.querySelectorAll('input[name="rfTipo"]').forEach(r => { r.checked = (r.value === 'dia'); });
    window.updateRefuerzoFechas();

    m.style.display = 'flex';
    setTimeout(() => m.classList.add('open'), 10);
};

window.closeRefuerzoModal = () => {
    const m = document.getElementById('modalRefuerzo');
    if (m) { m.classList.remove('open'); setTimeout(() => m.style.display = 'none', 300); }
};

window.updateRefuerzoFechas = () => {
    const tipo = document.querySelector('input[name="rfTipo"]:checked')?.value || 'dia';
    const g1 = document.getElementById('rfFechaGroup1');
    const g2 = document.getElementById('rfFechaGroup2');
    const label1 = g1?.querySelector('label');
    if (tipo === 'dia') {
        if (label1) label1.textContent = 'FECHA';
        if (g2) g2.style.display = 'none';
    } else if (tipo === 'semana') {
        if (label1) label1.textContent = 'INICIO DE SEMANA (LUNES)';
        if (g2) g2.style.display = 'none';
    } else {
        if (label1) label1.textContent = 'FECHA INICIO';
        if (g2) g2.style.display = '';
    }
};

window.openRefuerzoModal = async () => {
    const m = document.getElementById('modalRefuerzo');
    if (!m) return;
    const status = document.getElementById('refuerzoStatus');
    const warn = document.getElementById('refuerzoWarning');
    if (status) status.innerHTML = '';
    if (warn) { warn.style.display = 'none'; warn.textContent = ''; }

    const [hotels, emps] = await Promise.all([window.getAvailableHotels(), window.TurnosDB.getEmpleados()]);
    const selectedHotel = document.getElementById('excelHotel')?.value || 'all';

    // Hotel select — pre-select current Excel filter
    const rfHotel = document.getElementById('rfHotel');
    if (rfHotel) {
        rfHotel.innerHTML = hotels.map(h => `<option value="${h}"${h === selectedHotel && selectedHotel !== 'all' ? ' selected' : ''}>${h}</option>`).join('');
    }

    // Employee select — only structural support/ocasional staff with valid EMP-XXXX IDs
    const rfEmp = document.getElementById('rfEmp');
    if (rfEmp) {
        const supportEmps = emps
            .filter(e => {
                const idInt = String(e.id_interno || '').trim();
                if (!/^EMP-\d{4,}$/.test(idInt)) return false;
                if (window.isEmpleadoOcasionalOApoyo && window.isEmpleadoOcasionalOApoyo(e)) return true;
                return false;
            })
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        if (supportEmps.length === 0) {
            rfEmp.innerHTML = '<option value="" disabled selected>No hay empleados de apoyo con ID válido</option>';
        } else {
            rfEmp.innerHTML = '<option value="" disabled selected>Seleccionar empleado...</option>' +
                supportEmps.map(e => `<option value="${e.id}">${e.nombre || e.id} [${e.id_interno}]</option>`).join('');
        }
    }

    // Default date from Excel period
    const ds = document.getElementById('excelDateStart')?.value || '';
    const rfDateStart = document.getElementById('rfDateStart');
    if (rfDateStart) rfDateStart.value = ds;

    // Reset state
    document.getElementById('rfDateEnd').value = '';
    document.getElementById('rfTurno').value = '—';
    document.getElementById('rfObs').value = '';
    document.querySelectorAll('input[name="rfTipo"]').forEach(r => { r.checked = (r.value === 'dia'); });
    window.updateRefuerzoFechas();

    m.style.display = 'flex';
    setTimeout(() => m.classList.add('open'), 10);
};

window.closeRefuerzoModal = () => {
    const m = document.getElementById('modalRefuerzo');
    if (m) { m.classList.remove('open'); setTimeout(() => m.style.display = 'none', 300); }
};

window.updateRefuerzoFechas = () => {
    const tipo = document.querySelector('input[name="rfTipo"]:checked')?.value || 'dia';
    const g1 = document.getElementById('rfFechaGroup1');
    const g2 = document.getElementById('rfFechaGroup2');
    const label1 = g1?.querySelector('label');
    if (tipo === 'dia') {
        if (label1) label1.textContent = 'FECHA';
        if (g2) g2.style.display = 'none';
    } else if (tipo === 'semana') {
        if (label1) label1.textContent = 'INICIO DE SEMANA (LUNES)';
        if (g2) g2.style.display = 'none';
    } else {
        if (label1) label1.textContent = 'FECHA INICIO';
        if (g2) g2.style.display = '';
    }
};

window.saveRefuerzo = async () => {
    const status = document.getElementById('refuerzoStatus');
    const warn = document.getElementById('refuerzoWarning');
    const btn = document.getElementById('btnSaveRefuerzo');
    if (warn) { warn.style.display = 'none'; warn.textContent = ''; }

    const hotel = document.getElementById('rfHotel')?.value;
    const empId = document.getElementById('rfEmp')?.value;
    const tipo = document.querySelector('input[name="rfTipo"]:checked')?.value || 'dia';
    const turno = document.getElementById('rfTurno')?.value || '—';
    const obs = document.getElementById('rfObs')?.value || '';
    const dateStart = document.getElementById('rfDateStart')?.value;
    const dateEnd = document.getElementById('rfDateEnd')?.value;

    // Validations
    if (!hotel) { status.innerHTML = '<span style="color:var(--danger);">Hotel obligatorio.</span>'; return; }
    if (!empId) { status.innerHTML = '<span style="color:var(--danger);">Empleado obligatorio.</span>'; return; }
    if (!dateStart) { status.innerHTML = '<span style="color:var(--danger);">Fecha obligatoria.</span>'; return; }

    // Validate employee has valid ID
    const emp = (window.empleadosGlobales || []).find(e => e.id === empId);
    const idInt = String(emp?.id_interno || '').trim();
    if (!/^EMP-\d{4,}$/.test(idInt)) {
        status.innerHTML = '<span style="color:var(--danger);">Este empleado no tiene ID interno válido. No puede asignarse como refuerzo.</span>';
        return;
    }

    // Compute date range
    const dates = [];
    if (tipo === 'dia') {
        dates.push(dateStart);
    } else if (tipo === 'semana') {
        // From Monday to Sunday (7 days)
        const base = new Date(dateStart + 'T12:00:00');
        // Find Monday of that week
        const dow = base.getDay();
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        const monday = new Date(base);
        monday.setDate(monday.getDate() + mondayOffset);
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            dates.push(window.isoDate(d));
        }
    } else {
        // Rango
        if (!dateEnd) { status.innerHTML = '<span style="color:var(--danger);">Fecha fin obligatoria para rango.</span>'; return; }
        if (dateEnd < dateStart) { status.innerHTML = '<span style="color:var(--danger);">Fecha fin no puede ser anterior a inicio.</span>'; return; }
        const cur = new Date(dateStart + 'T12:00:00');
        const end = new Date(dateEnd + 'T12:00:00');
        while (cur <= end) {
            dates.push(window.isoDate(cur));
            cur.setDate(cur.getDate() + 1);
        }
        if (dates.length > 31) { status.innerHTML = '<span style="color:var(--danger);">Rango máximo: 31 días.</span>'; return; }
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Comprobando...';

        // Check for conflicts: employee has M/T/N in another hotel same day
        const existingAll = await window.TurnosDB.fetchTurnosBase(dates[0], dates[dates.length - 1], null);
        const conflicts = [];
        const duplicates = [];
        dates.forEach(d => {
            const existing = existingAll.filter(r => r.empleado_id === empId && r.fecha === d);
            existing.forEach(r => {
                if (r.hotel_id === hotel) {
                    duplicates.push({ date: d, turno: r.turno });
                } else {
                    const t = (r.turno || '').toUpperCase();
                    if (['M', 'T', 'N', 'MAÑANA', 'TARDE', 'NOCHE'].includes(t)) {
                        conflicts.push({ date: d, hotel: r.hotel_id, turno: r.turno });
                    }
                }
            });
        });

        // Block on conflicts
        if (conflicts.length > 0) {
            const cList = conflicts.map(c => `  ${c.date}: ${c.turno} en ${c.hotel}`).join('\n');
            status.innerHTML = `<span style="color:var(--danger);">Conflicto de ubicación:<br><pre style="font-size:0.7rem; margin-top:4px;">${cList}</pre></span>`;
            btn.disabled = false; btn.textContent = 'Añadir refuerzo';
            return;
        }

        // Warn on duplicates
        if (duplicates.length > 0) {
            const dList = duplicates.map(d => `  ${d.date}: ${d.turno}`).join('\n');
            if (!confirm(`Ya existen turnos para ${emp?.nombre || empId} en ${hotel}:\n${dList}\n\n¿Quieres reemplazarlos?`)) {
                btn.disabled = false; btn.textContent = 'Añadir refuerzo';
                return;
            }
        }

        // Build upsert records
        btn.textContent = 'Guardando...';
        const records = dates.map(d => ({
            empleado_id: empId,
            hotel_id: hotel,
            fecha: d,
            turno: turno,
            updated_by: 'ADMIN_REFUERZO'
        }));

        const { error } = await window.supabase.from('turnos').upsert(records, { onConflict: 'empleado_id,fecha' });
        if (error) throw error;

        if (window.addLog) window.addLog(`Refuerzo añadido: ${emp?.nombre || empId} en ${hotel} (${dates.length} día${dates.length !== 1 ? 's' : ''})`, 'info');

        status.innerHTML = `<span style="color:#10b981;">✓ Refuerzo añadido: ${dates.length} día${dates.length !== 1 ? 's' : ''}</span>`;
        setTimeout(async () => {
            window.closeRefuerzoModal();
            await window.renderExcelView();
        }, 1000);

    } catch (err) {
        console.error('[REFUERZO] Error:', err);
        status.innerHTML = `<span style="color:var(--danger);">Error: ${err.message}</span>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Añadir refuerzo';
    }
};

// ==========================================
// MÓDULO: CAMBIOS DE TURNO (DASHBOARD OPERATIVO)
// ==========================================
window.initChangesControls = () => {
    const rangeInput = document.getElementById('chRange');
    if (!rangeInput) return;

    const today = window.isoDate(new Date());
    const next365 = window.isoDate(new Date(Date.now() + 365 * 86400000));

    if (!rangeInput.value) rangeInput.value = `${today} a ${next365}`;

    if (window.flatpickr && !rangeInput._flatpickr) {
        window._changesRangePicker = window.flatpickr(rangeInput, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            locale: 'es',
            defaultDate: [today, next365],
            onClose: (selectedDates, dateStr) => {
                if (selectedDates.length === 2) {
                    rangeInput.value = dateStr;
                    window.renderChanges?.();
                }
            }
        });
    }

    if (!rangeInput.dataset.changeBound) {
        rangeInput.addEventListener('change', () => window.renderChanges?.());
        rangeInput.dataset.changeBound = '1';
    }
};

window.renderChanges = async () => {
    try {
        const tableBody = $('#changes-body');
        const upcomingList = $('#upcoming-changes-list');
        if (!tableBody) return;
        window.initChangesControls?.();

        let [events, hotels, requests] = await Promise.all([
            window.TurnosDB.fetchEventos(),
            window.TurnosDB.getHotels(),
            window.TurnosDB.fetchPeticiones ? window.TurnosDB.fetchPeticiones() : Promise.resolve([])
        ]);

        const normalizeChangeKey = (item) => [
            item.fecha_inicio || item.fecha || '',
            item.hotel_origen || item.hotel || '',
            item.empleado_id || item.solicitante || '',
            item.empleado_destino_id || item.companero || '',
            item.turno_nuevo || item.destino || ''
        ].map(v => String(v || '').trim().toLowerCase()).join('|');

        const eventPetitionIds = new Set((events || []).map(ev => ev.payload?.peticion_id).filter(Boolean));
        const eventKeys = new Set((events || [])
            .filter(ev => ['CAMBIO_TURNO', 'INTERCAMBIO_TURNO', 'INTERCAMBIO_HOTEL'].includes(ev.tipo))
            .map(ev => normalizeChangeKey(ev)));

        const pendingSyncMap = new Map();
        (requests || [])
            .filter(req => req.estado === 'aprobada' && !eventPetitionIds.has(req.id))
            .forEach(req => {
                (Array.isArray(req.fechas) ? req.fechas : []).forEach(f => {
                    const fecha = window.TurnosDB.normalizeDate ? window.TurnosDB.normalizeDate(f.fecha) : f.fecha;
                    const key = normalizeChangeKey({
                        fecha_inicio: fecha,
                        hotel_origen: req.hotel,
                        empleado_id: req.solicitante,
                        empleado_destino_id: req.companero,
                        turno_nuevo: f.destino
                    });
                    if (eventKeys.has(key)) return;
                    const current = pendingSyncMap.get(key);
                    const hasRealOrigin = f.origen && !/^[\s\u2014-]+$/.test(String(f.origen));
                    const currentOrigin = current?.fecha?.origen;
                    const currentHasRealOrigin = currentOrigin && !/^[\s\u2014-]+$/.test(String(currentOrigin));
                    if (!current || (hasRealOrigin && !currentHasRealOrigin)) pendingSyncMap.set(key, { req, fecha: f });
                });
            });

        if (pendingSyncMap.size && !window._syncingApprovedChangeRequests) {
            window._syncingApprovedChangeRequests = true;
            try {
                for (const item of pendingSyncMap.values()) {
                    await window.TurnosDB.actualizarEstadoPeticion(item.req.id, 'aprobada');
                }
                events = await window.TurnosDB.fetchEventos();
                requests = window.TurnosDB.fetchPeticiones ? await window.TurnosDB.fetchPeticiones() : requests;
            } finally {
                window._syncingApprovedChangeRequests = false;
            }
        }

        const changeSource = events || [];
        const hotelSel = $('#chHotel');
        if (hotelSel && hotelSel.options.length <= 1) {
            hotels.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h; opt.textContent = h;
                hotelSel.appendChild(opt);
            });
        }

        const search = ($('#chSearch')?.value || '').toLowerCase();
        const selHotel = $('#chHotel')?.value || 'all';
        const selType = $('#chType')?.value || 'all';
        const selStatus = $('#chStatus')?.value || 'activo';
        
        let filtered = changeSource.filter(ev => ['CAMBIO_TURNO', 'INTERCAMBIO_TURNO', 'INTERCAMBIO_HOTEL'].includes(ev.tipo));
        
        const now = new Date();
        const isoNow = window.isoDate(now);
        const next365 = window.isoDate(new Date(now.getTime() + 365 * 86400000));
        const rangeVal = ($('#chRange')?.value || '').trim();

        if (rangeVal.includes(' a ')) {
            const [s, e] = rangeVal.split(' a ').map(v => v.trim());
            filtered = filtered.filter(ev => ev.fecha_inicio >= s && ev.fecha_inicio <= e);
        } else if (!search && !rangeVal && selStatus === 'activo') {
            filtered = filtered.filter(ev => ev.fecha_inicio >= isoNow && ev.fecha_inicio <= next365);
        }

        const isVisibleActiveChange = (estado) => ['activo', 'aprobada', 'pendiente', ''].includes(String(estado || '').toLowerCase());
        if (selStatus === 'activo') filtered = filtered.filter(ev => isVisibleActiveChange(ev.estado));
        else if (selStatus !== 'all') filtered = filtered.filter(ev => (ev.estado || 'activo') === selStatus);
        if (selHotel !== 'all') filtered = filtered.filter(ev => ev.hotel_origen === selHotel || ev.hotel_destino === selHotel);
        if (selType !== 'all') filtered = filtered.filter(ev => ev.tipo === selType);
        
        if (search) {
            filtered = filtered.filter(ev => 
                (ev.empleado_id || '').toLowerCase().includes(search) || 
                (ev.empleado_destino_id || '').toLowerCase().includes(search) || 
                (ev.turno_original || ev.payload?.origen || '').toLowerCase().includes(search) ||
                (ev.turno_nuevo || ev.payload?.destino || '').toLowerCase().includes(search) ||
                (ev.observaciones || '').toLowerCase().includes(search)
            );
        }

        filtered.sort((a,b) => a.fecha_inicio.localeCompare(b.fecha_inicio));

        const next30 = window.isoDate(new Date(now.getTime() + 30 * 86400000));
        const activos = filtered.filter(ev => ['activo', 'aprobada', 'pendiente', ''].includes(String(ev.estado || '').toLowerCase())).length;
        const p30d = filtered.filter(ev => ev.fecha_inicio >= isoNow && ev.fecha_inicio <= next30).length;
        
        const affectedSet = new Set();
        filtered.forEach(ev => {
            if (ev.empleado_id) affectedSet.add(ev.empleado_id);
            if (ev.empleado_destino_id) affectedSet.add(ev.empleado_destino_id);
        });

        if ($('#ch-stat-total')) $('#ch-stat-total').textContent = activos;
        if ($('#ch-stat-30d')) $('#ch-stat-30d').textContent = p30d;
        if ($('#ch-stat-emps')) $('#ch-stat-emps').textContent = affectedSet.size;

        const shiftLabel = (value) => {
            if (window.isInvalidLegacyChangeValue(value)) return '—';
            const raw = String(value || '').trim();
            if (!raw) return '—';
            const norm = window.normalizeShiftValue(raw);
            if (norm === 'M') return 'Mañana';
            if (norm === 'T') return 'Tarde';
            if (norm === 'N') return 'Noche';
            if (norm === 'D') return 'Descanso';
            return raw;
        };
        const shiftClass = (value) => {
            const norm = window.normalizeShiftValue(value);
            if (norm) return norm.toLowerCase();
            return 'x';
        };
        const shiftChip = (value) => `<span class="turno-pill-mini ${shiftClass(value)}" style="width:auto; min-width:58px; height:auto; padding:4px 8px; font-size:0.65rem;">${shiftLabel(value)}</span>`;
        const changeDetail = (ev) => {
            const original = ev.turno_original || ev.payload?.origen || ev.payload?.original_data?.origen;
            const requested = ev.turno_nuevo || ev.payload?.destino || ev.payload?.original_data?.destino;
            if (!original && !requested) return '<span style="color:#94a3b8; font-size:0.75rem; font-weight:700;">Sin detalle</span>';
            return `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">${shiftChip(original)}<span style="color:#94a3b8; font-weight:900;">→</span>${shiftChip(requested)}</div>`;
        };

        // DEDUPLICACIÓN EN PANEL (V12.5.19)
        const intercambiosMap = new Set(filtered.filter(ev => ev.tipo === 'INTERCAMBIO_TURNO').map(ev => `${ev.fecha_inicio}|${ev.empleado_id}|${ev.empleado_destino_id}`));

        tableBody.innerHTML = filtered.map(ev => {
            const dateFmt = window.TurnosDB.fmtDateLegacy(ev.fecha_inicio);
            const typeLabel = ev.tipo === 'CAMBIO_TURNO' ? 'CAMBIO PUNTUAL' : (ev.tipo === 'INTERCAMBIO_TURNO' ? 'INTERCAMBIO' : 'CAMBIO HOTEL');
            const typeClass = ev.tipo === 'CAMBIO_TURNO' ? 'tag-info' : 'tag-warning';
            
            // Determinar estado de integridad
            let integrityLabel = 'OK';
            let integrityClass = 'status-ok';
            
            const tOrig = ev.turno_original || ev.turno_origen;
            const tDest = ev.turno_nuevo || ev.turno_destino;
            const hasLegacy = window.isInvalidLegacyChangeValue(tOrig) || window.isInvalidLegacyChangeValue(tDest);
            const isDuplicate = ev.tipo === 'CAMBIO_TURNO' && intercambiosMap.has(`${ev.fecha_inicio}|${ev.empleado_id}|${ev.empleado_destino_id}`);

            if (isDuplicate) {
                integrityLabel = 'DUPLICADO IGNORADO';
                integrityClass = 'status-warning';
            } else if (hasLegacy) {
                const canReconstruct = (ev.empleado_id && (ev.empleado_destino_id || ev.tipo !== 'INTERCAMBIO_TURNO'));
                integrityLabel = canReconstruct ? 'LEGACY CT / RECONSTRUIDO' : 'LEGACY CT / INCOMPLETO';
                integrityClass = canReconstruct ? 'status-info' : 'status-danger';
            }

            return `
                <tr style="border-bottom:1px solid #f1f5f9; transition:0.2s; ${isDuplicate ? 'opacity:0.6;' : ''}" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" ondblclick="window.editChange('${ev.id}')" title="Doble clic para editar el cambio">
                    <td style="padding:15px; font-weight:700; color:#2563eb;">
                        <button type="button" onclick="event.stopPropagation(); window.editChange('${ev.id}')" title="Editar cambio" style="border:0; background:transparent; color:#2563eb; font:inherit; font-weight:800; padding:0; cursor:pointer;">${dateFmt}</button>
                    </td>
                    <td style="padding:15px; font-size:0.85rem; color:#64748b;">${ev.hotel_origen || '—'}</td>
                    <td style="padding:15px;">
                        <div style="font-weight:800; font-size:0.9rem;">${ev.empleado_id} ${ev.empleado_destino_id ? '<span style="color:#94a3b8; font-weight:400; margin:0 4px;">↔</span> ' + ev.empleado_destino_id : ''}</div>
                    </td>
                    <td style="padding:15px;">${changeDetail(ev)}</td>
                    <td style="padding:15px;">
                        <span class="panel-tag ${typeClass}" style="font-size:0.6rem; letter-spacing:0.02em;">${typeLabel}</span>
                        <div class="integrity-badge ${integrityClass}" style="font-size:0.55rem; margin-top:4px; font-weight:800;">${integrityLabel}</div>
                    </td>
                    <td style="padding:15px; font-size:0.8rem; color:#64748b; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.observaciones || '—'}</td>
                    <td style="padding:15px; text-align:center;">
                        <div style="display:flex; gap:6px; justify-content:center;">
                            <button class="btn-icon" onclick="window.editChange('${ev.id}')" title="Gestionar"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon danger" onclick="window.anularChange('${ev.id}')" title="Anular"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="7" style="padding:3rem; text-align:center; opacity:0.5;">No hay cambios registrados.</td></tr>';

        const upcoming = filtered.filter(ev => ev.fecha_inicio >= isoNow && (ev.estado || 'activo') === 'activo')
                                 .sort((a,b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
                                 .slice(0, 10);
        
        upcomingList.innerHTML = upcoming.map(ev => `
            <div style="padding:12px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
                <div style="font-weight:800; font-size:0.8rem; color:#1e293b;">${window.TurnosDB.fmtDateLegacy(ev.fecha_inicio)} · ${ev.hotel_origen}</div>
                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${ev.empleado_id} ${ev.empleado_destino_id ? '↔ ' + ev.empleado_destino_id : ''}</div>
                <div style="font-size:0.72rem; color:#475569; margin-top:6px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">${changeDetail(ev)}</div>
            </div>
        `).join('') || '<div style="padding:10px; text-align:center; opacity:0.5; font-size:0.8rem;">No hay cambios próximos.</div>';
    } catch (err) {
        console.error('[CHANGES ERROR]', err);
        if (document.querySelector('#changes-body')) document.querySelector('#changes-body').innerHTML = '<tr><td colspan="7" style="padding:3rem; text-align:center; color:#b91c1c;">Error cargando cambios.</td></tr>';
    }
};

window.ensureChangeEditModal = () => {
    if (document.getElementById('changeEditModal')) return;
    const modal = document.createElement('div');
    modal.id = 'changeEditModal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:9999; display:none; align-items:center; justify-content:center; background:rgba(15,23,42,0.55); backdrop-filter:blur(8px); padding:24px;';
    modal.innerHTML = `
        <form id="changeEditForm" onsubmit="window.saveChangeEdit(event)" style="width:min(760px, calc(100vw - 40px)); max-height:calc(100vh - 48px); overflow:auto; background:#fff; border:1px solid #dbe6f3; border-radius:22px; box-shadow:0 24px 70px rgba(15,23,42,0.28);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:22px 26px; border-bottom:1px solid #e2e8f0;">
                <div>
                    <h3 style="margin:0; font-size:1.05rem; font-weight:900; color:#0f172a;">Editar cambio operativo</h3>
                    <p id="changeEditId" style="margin:5px 0 0; font-size:0.72rem; color:#64748b; font-weight:700;"></p>
                </div>
                <button type="button" onclick="window.closeChangeEditModal()" style="width:42px; height:42px; border-radius:14px; border:1px solid #dbe6f3; background:#fff; color:#334155; font-size:1.3rem; cursor:pointer;">&times;</button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; padding:24px 26px;">
                <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Fecha
                    <input id="edit-change-date" type="date" required style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;">
                </label>
                <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Hotel
                    <select id="edit-change-hotel" style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;"></select>
                </label>
                <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Solicitante
                    <input id="edit-change-employee" type="text" required style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;">
                </label>
                <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Compa&ntilde;ero
                    <input id="edit-change-target" type="text" style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;">
                </label>
                <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Turno original
                    <select id="edit-change-origin" style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;">
                        <option value="">—</option><option value="Mañana">Mañana</option><option value="Tarde">Tarde</option><option value="Noche">Noche</option><option value="Descanso">Descanso</option>
                    </select>
                </label>
                <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Turno solicitado
                    <select id="edit-change-dest" style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;">
                        <option value="">—</option><option value="Mañana">Mañana</option><option value="Tarde">Tarde</option><option value="Noche">Noche</option><option value="Descanso">Descanso</option>
                    </select>
                </label>
                <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Tipo
                    <select id="edit-change-type" style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;">
                        <option value="INTERCAMBIO_TURNO">Intercambio</option><option value="CAMBIO_TURNO">Cambio puntual</option><option value="INTERCAMBIO_HOTEL">Cambio hotel</option>
                    </select>
                </label>
                <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Estado
                    <select id="edit-change-status" style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;">
                        <option value="activo">Activo</option><option value="anulado">Anulado</option>
                    </select>
                </label>
                <label style="grid-column:1 / -1; display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Observacion
                    <textarea id="edit-change-obs" rows="3" style="border:1px solid #d5e1ef; border-radius:14px; padding:12px 14px; font-size:0.95rem; font-weight:700; resize:vertical;"></textarea>
                </label>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; padding:18px 26px; border-top:1px solid #e2e8f0; background:#f8fafc;">
                <button type="button" onclick="window.closeChangeEditModal()" class="btn-premium" style="min-height:44px;">Cancelar</button>
                <button id="btnSaveChangeEdit" type="submit" class="btn-premium" style="min-height:44px; background:#2563eb; color:#fff; border-color:#2563eb;">Guardar cambio</button>
            </div>
        </form>
    `;
    document.body.appendChild(modal);
};

window.closeChangeEditModal = () => {
    const modal = document.getElementById('changeEditModal');
    if (modal) modal.style.display = 'none';
    window._editingChangeEvent = null;
};

window.editChange = async (id) => {
    try {
        window.ensureChangeEditModal();
        const [eventos, hotels] = await Promise.all([
            window.TurnosDB.fetchEventos(),
            window.TurnosDB.getHotels()
        ]);
        const ev = (eventos || []).find(item => String(item.id) === String(id));
        if (!ev) throw new Error('No se encontro el cambio seleccionado');
        window._editingChangeEvent = ev;

        const hotelSelect = document.getElementById('edit-change-hotel');
        hotelSelect.innerHTML = `<option value="">Sin hotel</option>${(hotels || []).map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('')}`;

        const setValue = (fieldId, value) => {
            const field = document.getElementById(fieldId);
            if (field) field.value = value || '';
        };
        const toShiftSelectValue = (value) => {
            const norm = window.normalizeShiftValue ? window.normalizeShiftValue(value) : String(value || '').trim().toUpperCase();
            if (norm === 'M') return 'Mañana';
            if (norm === 'T') return 'Tarde';
            if (norm === 'N') return 'Noche';
            if (norm === 'D') return 'Descanso';
            return value || '';
        };
        setValue('edit-change-date', ev.fecha_inicio || '');
        setValue('edit-change-hotel', ev.hotel_origen || ev.hotel_destino || '');
        setValue('edit-change-employee', ev.empleado_id || '');
        setValue('edit-change-target', ev.empleado_destino_id || '');
        setValue('edit-change-origin', toShiftSelectValue(ev.turno_original || ev.payload?.origen || ''));
        setValue('edit-change-dest', toShiftSelectValue(ev.turno_nuevo || ev.payload?.destino || ''));
        setValue('edit-change-type', ev.tipo || 'INTERCAMBIO_TURNO');
        setValue('edit-change-status', ev.estado || 'activo');
        setValue('edit-change-obs', ev.observaciones || '');

        const idLabel = document.getElementById('changeEditId');
        if (idLabel) idLabel.textContent = `ID protegido: ${ev.id}`;
        document.getElementById('changeEditModal').style.display = 'flex';
    } catch (err) {
        alert('No se pudo abrir la edicion: ' + err.message);
    }
};

window.saveChangeEdit = async (event) => {
    event.preventDefault();
    const original = window._editingChangeEvent;
    if (!original) return;
    const btn = document.getElementById('btnSaveChangeEdit');
    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Guardando...';
        }
        const fecha = document.getElementById('edit-change-date')?.value;
        const hotel = document.getElementById('edit-change-hotel')?.value || null;
        const empleado = document.getElementById('edit-change-employee')?.value?.trim();
        const companero = document.getElementById('edit-change-target')?.value?.trim() || null;
        const turnoOriginal = document.getElementById('edit-change-origin')?.value || null;
        const turnoNuevo = document.getElementById('edit-change-dest')?.value || null;
        const tipo = document.getElementById('edit-change-type')?.value || original.tipo || 'INTERCAMBIO_TURNO';
        const estado = document.getElementById('edit-change-status')?.value || 'activo';
        const observaciones = document.getElementById('edit-change-obs')?.value?.trim() || null;
        if (!fecha || !empleado) throw new Error('Fecha y solicitante son obligatorios');

        await window.TurnosDB.upsertEvento({
            ...original,
            tipo,
            empleado_id: empleado,
            empleado_destino_id: companero,
            hotel_origen: hotel,
            hotel_destino: hotel,
            fecha_inicio: fecha,
            fecha_fin: fecha,
            turno_original: turnoOriginal,
            turno_nuevo: turnoNuevo,
            estado,
            observaciones,
            payload: {
                ...(original.payload || {}),
                origen: turnoOriginal,
                destino: turnoNuevo,
                edited_from_admin: true,
                edited_at: new Date().toISOString()
            }
        });

        window.closeChangeEditModal();
        await window.renderChanges();
    } catch (err) {
        alert('Error guardando cambio: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Guardar cambio';
        }
    }
};

window.anularChange = async (id) => {
    if (!confirm("¿Estás seguro de anular este cambio operativo?")) return;
    try {
        const eventos = await window.TurnosDB.fetchEventos();
        const evento = (eventos || []).find(ev => String(ev.id) === String(id));
        const peticionId = evento?.payload?.peticion_id;
        await window.TurnosDB.anularEvento(id);
        if (peticionId) await window.TurnosDB.actualizarEstadoPeticion(peticionId, 'anulada');
        alert("Cambio anulado correctamente.");
        window.renderChanges();
    } catch (err) { alert("Error al anular: " + err.message); }
};

// ==========================================
// MÓDULO: SOLICITUDES (RESTAURADO)
// ==========================================
window.renderRequests = async () => {
    try {
    console.log("[ADMIN] Iniciando renderRequests...");
    const container = $('#changes-content');
    if (!container) return;
    
    if (!window._requestsFilter) window._requestsFilter = 'pendiente';

    container.innerHTML = `
        <div class="requests-toolbar" style="display:flex; align-items:center; gap:20px; margin-bottom:20px; background:white; padding:15px 25px; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="font-size:0.75rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Filtrar por:</div>
            <select id="requestsFilter" class="toolbar-input" style="padding:8px 15px; border-radius:10px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:700; color:#1e293b; cursor:pointer;" onchange="window._requestsFilter = this.value; window.renderRequests()">
                <option value="pendiente" ${window._requestsFilter === 'pendiente' ? 'selected' : ''}>Pendientes de Revisión</option>
                <option value="aprobada" ${window._requestsFilter === 'aprobada' ? 'selected' : ''}>Aprobadas</option>
                <option value="rechazada" ${window._requestsFilter === 'rechazada' ? 'selected' : ''}>Rechazadas</option>
                <option value="all" ${window._requestsFilter === 'all' ? 'selected' : ''}>Todas las Solicitudes</option>
            </select>
            <div id="requestsCount" style="margin-left:auto; font-size:0.8rem; font-weight:700; color:#0ea5e9;">Cargando...</div>
        </div>
        <div id="requests-list">
            <div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando solicitudes...</div>
        </div>
    `;

        const data = await window.TurnosDB.fetchPeticiones();
        console.log("[ADMIN] Peticiones recibidas:", data.length);
        
        let filtered = data;
        if (window._requestsFilter !== 'all') {
            filtered = data.filter(r => r.estado === window._requestsFilter);
        }

        $('#requestsCount').textContent = `${filtered.length} resultados`;
        const listContainer = $('#requests-list');

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;">No hay solicitudes que coincidan con el filtro.</div>';
            return;
        }

        listContainer.innerHTML = filtered.map(req => {
            const statusLabel = req.estado === 'pendiente' ? 'Pendiente' : (req.estado === 'aprobada' ? 'Aprobada' : 'Rechazada');
            const statusColor = req.estado === 'pendiente' ? '#f59e0b' : (req.estado === 'aprobada' ? '#10b981' : '#ef4444');
            const borderCol = req.estado === 'pendiente' ? '#f59e0b' : (req.estado === 'aprobada' ? '#10b981' : '#ef4444');

            return `
                <div class="request-card-admin" style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); border-left:6px solid ${borderCol};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="font-size:0.7rem; font-weight:800; color:#0ea5e9; text-transform:uppercase;">${req.hotel}</div>
                                <span style="font-size:0.65rem; padding:2px 8px; border-radius:10px; background:${statusColor}22; color:${statusColor}; font-weight:800; text-transform:uppercase;">${statusLabel}</span>
                            </div>
                            <h3 style="font-size:1.1rem; font-weight:800; margin:4px 0;">${req.solicitante} ${req.companero ? '& ' + req.companero : ''}</h3>
                            <div style="font-size:0.8rem; color:#64748b;">Solicitado el ${new Date(req.created_at).toLocaleString()}</div>
                        </div>
                        ${req.estado === 'pendiente' ? `
                            <div style="display:flex; gap:8px;">
                                <button onclick="window.handleRequestAction('${req.id}', 'rechazada')" style="background:#fee2e2; color:#991b1b; border:none; padding:8px 16px; border-radius:8px; font-weight:700; cursor:pointer;">Denegar</button>
                                <button onclick="window.handleRequestAction('${req.id}', 'aprobada')" style="background:#dcfce7; color:#166534; border:none; padding:8px 16px; border-radius:8px; font-weight:700; cursor:pointer;">Aprobar</button>
                            </div>
                        ` : `
                            <button onclick="window.handleRequestAction('${req.id}', 'pendiente')" style="background:#f1f5f9; color:#475569; border:none; padding:8px 16px; border-radius:8px; font-weight:700; cursor:pointer;">Resetear a Pendiente</button>
                        `}
                    </div>
                    <div style="margin-top:16px; display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
                        ${(req.fechas || []).map(f => `
                            <div style="background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0;">
                                <div style="font-weight:800; font-size:0.85rem;">${f.fecha}</div>
                                <div style="font-size:0.8rem; color:#64748b;">${f.origen} → ${f.destino}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) { 
        console.error("[ADMIN ERROR] renderRequests:", e);
        container.innerHTML = '<div style="padding:2rem; color:red; font-weight:800;">❌ Error cargando solicitudes: ' + e.message + '</div>'; 
    }
};

window.handleRequestAction = async (id, newState) => {
    if (!confirm(`¿Estás seguro de marcar como ${newState}?`)) return;
    try {
        await window.TurnosDB.actualizarEstadoPeticion(id, newState);
        alert('Solicitud actualizada.');
        window.renderRequests();
    } catch (e) { alert('Error: ' + e.message); }
};

// ==========================================
// MÓDULO: FICHA EMPLEADO HELPERS (RESTAURADO)
// ==========================================
window.enableEmployeeProfileEdit = () => {
    window._employeeProfileTab = 'config';
    window.renderEmployeeProfile();
};

window.setEmployeeProfileTab = (tab) => {
    window._employeeProfileTab = tab;
    window.renderEmployeeProfile();
};

window.moveEmployeeProfilePeriod = (direction) => {
    const current = new Date(`${window._employeeProfileDate || window.isoDate(new Date())}T12:00:00`);
    current.setMonth(current.getMonth() + direction);
    window._employeeProfileDate = window.isoDate(current);
    window.renderEmployeeProfile();
};

window.saveEmployeeProfileInline = async () => {
    const empId = window._employeeProfileId;
    if (!empId) return;
    const nombre = $('#edit-emp-nombre')?.value;
    const hotel = $('#edit-emp-hotel')?.value;
    const puesto = $('#edit-emp-puesto')?.value;
    const vacAnuales = Number($('#edit-emp-vac-anuales')?.value || 44);
    const vacAjuste = Number($('#edit-emp-vac-ajuste')?.value || 0);
    
    try {
        const { error } = await window.supabase.from('empleados').update({
            nombre, 
            hotel_id: hotel, 
            puesto,
            vacaciones_anuales: vacAnuales,
            ajuste_vacaciones_dias: vacAjuste
        }).eq('id', empId);
        if (error) throw error;
        alert('Ficha actualizada correctamente.');
        await window.populateEmployees();
        window.renderEmployeeProfile();
    } catch (e) { alert('Error al guardar: ' + e.message); }
};

// --- SOPORTE LEGACY / EXCEL SOURCE ---
window.loadAdminExcelSourceRows = async () => {
    if (window._cachedExcelSource) return window._cachedExcelSource;
    return {};
};

// 1.1 HELPER DE FECHAS ROBUSTO (UNIFICADO)
window.isoDate = (value) => {
    if (value === null || value === undefined || value === '') return null;
    
    // Si ya es un objeto Date
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    const s = String(value).trim();
    
    // ISO YYYY-MM-DD...
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    
    // Formato dd/mm/yyyy o dd-mm-yyyy
    const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        let year = dmyMatch[3];
        if (year.length === 2) year = (Number(year) > 50 ? '19' : '20') + year;
        return `${year}-${month}-${day}`;
    }
    
    // Fallback normalizador si existe en resolver
    if (window.normalizeDate && value !== s) return window.normalizeDate(value);

    console.warn('[isoDate] Valor de fecha no reconocido:', value);
    return null;
};

// 1.2 HELPERS DE FECHAS Y OPERATIVA
window.getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

window.addIsoDays = (iso, n) => {
    if (!iso) return null;
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return window.isoDate(d);
};

window.getFechasSemana = (lunesIso) => {
    return Array.from({ length: 7 }, (_, i) => window.addIsoDays(lunesIso, i));
};

window.openEmpDrawer = (id) => {
    window._employeeProfileId = id;
    window._employeeProfileDate = window._employeeProfileDate || window.isoDate(new Date());
    window._employeeProfileTab = window._employeeProfileTab || 'overview';
    window.renderEmployeeProfile?.();
};

// 1.2 SISTEMA DE DIAGNÓSTICO VISUAL DE ERRORES
window.showDiagnostic = (error, source = 'Error Global') => {
    const overlay = $('#diagnostic-overlay');
    if (!overlay) return;

    const message = error.message || String(error);
    const stack = error.stack || '';
    
    // Extraer archivo y línea (simplificado)
    const stackLines = stack.split('\n');
    const firstLine = stackLines[0] || '';
    const secondLine = stackLines[1] || ''; // Suele contener la ubicación real
    const locMatch = secondLine.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/) || secondLine.match(/at\s+(.+):(\d+):(\d+)/);
    
    let location = 'Desconocida';
    if (locMatch) {
        const file = locMatch[2] || locMatch[1];
        const line = locMatch[3] || locMatch[2];
        location = `${file.split('/').pop()} : L${line}`;
    }

    // Mapeo de módulos
    let module = 'Desconocido';
    let section = null;
    if (stack.includes('renderDashboard')) { module = 'Dashboard'; section = 'home'; }
    else if (stack.includes('renderEmployeeProfile')) { module = 'Ficha Empleado'; section = 'employees'; }
    else if (stack.includes('renderExcelView')) { module = 'Modo Excel'; section = 'excel'; }
    else if (stack.includes('renderPreview')) { module = 'Vista Previa'; section = 'preview'; }
    else if (stack.includes('publishToSupabase')) { module = 'Publicación'; }
    else if (message.includes('isoDate')) { module = 'Sistema (Fechas)'; }

    $('#diag-module-tag').textContent = `${module} [${location}]`;
    $('#diag-message').textContent = message;
    $('#diag-stack').textContent = stack || 'Sin traza disponible';
    
    const modBtn = $('#diag-module-btn');
    if (section && window.switchSection) {
        modBtn.style.display = 'block';
        modBtn.onclick = () => {
            window.switchSection(section);
            overlay.style.display = 'none';
        };
        modBtn.textContent = `Ir a sección: ${module}`;
    } else {
        modBtn.style.display = 'none';
    }

    overlay.style.display = 'block';
    console.error('[DIAGNÓSTICO]', { module, message, location, stack });
};

window.copyDiagnostic = () => {
    const text = `ERROR DIAGNÓSTICO\nMódulo: ${$('#diag-module-tag').textContent}\nMensaje: ${$('#diag-message').textContent}\nStack: ${$('#diag-stack').textContent}`;
    navigator.clipboard.writeText(text).then(() => alert('Copiado al portapapeles'));
};

window.addEventListener('error', (e) => {
    // Evitar bucles
    if (e.message.includes('showDiagnostic')) return;
    window.showDiagnostic(e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    window.showDiagnostic(e.reason || 'Rechazo de promesa desconocido');
});

// Nota: Los helpers normalizeId, normalizeDate, normalizeTipo, etc. ahora son globales 
// y residen en shift-resolver.js para evitar discrepancias.

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

// Ficha profesional de empleado: modelo visual + render del panel.
window.employeeDateLabel = (iso, options = {}) => {
    if (!iso) return '&mdash;';
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', options);
};

window.employeeEventDateRange = (ev) => {
    const start = String(ev?.fecha_inicio || ev?.fecha || '').slice(0, 10);
    const end = String(ev?.fecha_fin || start || '').slice(0, 10);
    return `${start || '&mdash;'} - ${end || 'abierta'}`;
};

window.employeeShiftClass = (value, incidencia = null) => {
    const type = String(incidencia || '').toUpperCase();
    if (type === 'VAC') return 'vac';
    if (type === 'BAJA' || type === 'PERM') return 'baja';
    const code = window.normalizePreviewTurno ? window.normalizePreviewTurno(value || '') : String(value || '').toUpperCase();
    if (code === 'M') return 'm';
    if (code === 'T') return 't';
    if (code === 'N') return 'n';
    if (code === 'D') return 'd';
    return 'x';
};

window.employeeShiftLabel = (item) => {
    if (!item) return '&mdash;';
    if (item.conflicto) return 'Conflicto';
    if (item.incidencia === 'VAC') return 'Vacaciones';
    if (item.incidencia === 'BAJA') return 'Baja';
    if (item.incidencia === 'PERM') return 'Permiso';
    const raw = item.turno || item.turnoBase || item.turno_base || '';
    if (!raw) return '&mdash;';
    const key = window.normalizePreviewTurno ? window.normalizePreviewTurno(raw) : String(raw).toUpperCase();
    return ({ M: 'Mañana', T: 'Tarde', N: 'Noche', D: 'Descanso' }[key]) || raw;
};

window.employeeFormatNumber = (value) => {
    if (value === 0) return '0';
    if (value === null || typeof value === 'undefined' || value === '') return '&mdash;';
    return escapeHtml(value);
};

window.employeeAvatar = (name) => {
    const initials = String(name || '?')
        .split(' ')
        .filter(n => n)
        .map(n => n[0].toUpperCase())
        .slice(0, 2)
        .join('');
    return `<div class="emp-avatar">${initials}</div>`;
};

window.employeeIcon = (key) => {
    const icons = {
        hotel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
        role: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>',
        status: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
        laboral: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
        contacto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
        notas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
        vacaciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path><path d="M12 7v5l3 3"></path></svg>',
        descansos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>',
        cambios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>',
        eventos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
        profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        id: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="7" y1="8" x2="17" y2="8"></line><line x1="7" y1="12" x2="17" y2="12"></line><line x1="7" y1="16" x2="13" y2="16"></line></svg>',
        person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
        calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
        phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
        mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
        toggle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect><circle cx="16" cy="12" r="3"></circle></svg>'
    };
    return icons[key] || '';
};

window.employeeCalendarRange = (fechaReferencia, mode = 'month') => {
    const ref = new Date(`${fechaReferencia || window.isoDate(new Date())}T12:00:00`);
    const dates = [];
    if (mode === 'month') {
        const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
        let cursor = new Date(first);
        const day = cursor.getDay(); // 0: dom, 1: lun
        const diff = day === 0 ? 6 : day - 1;
        cursor.setDate(cursor.getDate() - diff);
        for (let i = 0; i < 42; i++) {
            dates.push(window.isoDate(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }
    const monday = window.getMonday ? window.getMonday(ref) : new Date(ref);
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(window.isoDate(d));
    }
    return dates;
};

window.calcularCondicionesEmpleado = (empleadoId) => {
    const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empleadoId) || window.normalizeId(e.nombre) === window.normalizeId(empleadoId));
    if (!profile) return null;

    const hoy = new Date();
    const currentYear = hoy.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    
    const altaISO = profile.fecha_alta || profile.antiguedad || window.isoDate(hoy);
    const alta = new Date(`${altaISO}T12:00:00`);
    
    const inicioCalculoVac = alta > startOfYear ? alta : startOfYear;
    const diasEnAño = Math.max(0, Math.floor((hoy - inicioCalculoVac) / (1000 * 60 * 60 * 24)) + 1);
    const diasTotales = Math.max(0, Math.floor((hoy - alta) / (1000 * 60 * 60 * 24)) + 1);

    const esFijo = window.normalizeId(profile.tipo || '').includes('fijo');
    const regularizacion = Number(profile.ajuste_vacaciones_dias || 0);

    const startOfYearISO = window.isoDate(startOfYear);
    const hoyISO = window.isoDate(hoy);
    
    // IMPORTANTE: Usamos los eventos globales cargados
    const eventos = window.eventosActivos || [];
    const baseIndex = window._lastBaseIndex;

    const historialReal = window.generarHistorialDesdeResolver ? 
        window.generarHistorialDesdeResolver(empleadoId, startOfYearISO, hoyISO, eventos, baseIndex) : [];

    const vacacionesUsadas = historialReal.filter(h => h.incidencia === 'VAC').length;
    const descansosReales = historialReal.filter(h => h.turno === 'D').length;
    const descansosEsperados = Math.floor((diasTotales / 7) * 2);

    // Si es fijo 44, si no proporcional.
    const derechoAnual = Number(profile.vacaciones_anuales || 44);
    const generadas = esFijo ? derechoAnual : Math.round((derechoAnual * diasEnAño) / 365);

    return {
        vacaciones: {
            derechoAnual: derechoAnual,
            generadas,
            usadas: vacacionesUsadas,
            saldo: (esFijo ? derechoAnual : generadas) + regularizacion - vacacionesUsadas
        },
        descansos: {
            esperados: descansosEsperados,
            reales: descansosReales,
            diferencia: descansosReales - descansosEsperados
        },
        meta: {
            diasEnAño,
            diasTotales,
            esFijo,
            regularizacion
        }
    };
};

window.generarHistorialDesdeResolver = (empleadoId, fechaInicio, fechaFin, explicitEvents, explicitIndex) => {
    if (!window.resolveEmployeeDay) return [];
    
    const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empleadoId) || window.normalizeId(e.nombre) === window.normalizeId(empleadoId));
    const eventos = explicitEvents || window.eventosActivos || [];
    const baseIndex = explicitIndex || window._lastBaseIndex;

    const dates = [];
    let curr = new Date(fechaInicio + 'T12:00:00');
    const end = new Date(fechaFin + 'T12:00:00');
    while (curr <= end) {
        dates.push(window.isoDate(curr));
        curr.setDate(curr.getDate() + 1);
    }
    
    return dates.map(fecha => {
        const res = window.resolveEmployeeDay({
            empleado: profile,
            empleadoId,
            fecha,
            eventos,
            baseIndex,
            allEvents: eventos,
            resolveId: resolveId
        });
        return {
            fecha,
            turno: res.turno,
            incidencia: res.incidencia,
            cambio: res.cambio,
            real: res.turno,
            titular: res.sustituidoPor || res.empleadoId,
            turno_base: res.turnoBase
        };
    });
};

window.groupConsecutiveEvents = (events) => {
    if (!events || events.length === 0) return [];
    
    // Tipos que queremos agrupar
    const groupableTypes = ['VAC', 'BAJA', 'PERMISO', 'PERM'];
    
    // Separar los que agrupamos de los que no
    const toGroup = events.filter(e => groupableTypes.some(t => String(e.tipo || '').toUpperCase().startsWith(t)));
    const others = events.filter(e => !groupableTypes.some(t => String(e.tipo || '').toUpperCase().startsWith(t)));
    
    // Agrupar por empleado para procesar por separado
    const byEmp = {};
    toGroup.forEach(e => {
        const key = e.empleado_id || e.empleado_uuid || 'unknown';
        if (!byEmp[key]) byEmp[key] = [];
        byEmp[key].push(e);
    });
    
    const finalGroups = [];
    
    Object.values(byEmp).forEach(empEvents => {
        // Ordenar por fecha de inicio
        empEvents.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
        
        let currentGroup = null;
        
        empEvents.forEach(e => {
            if (!currentGroup) {
                currentGroup = { 
                    ...e, 
                    fecha_fin: e.fecha_fin || e.fecha_inicio, 
                    ids: [e.id],
                    isGroup: false 
                };
            } else {
                const lastEnd = new Date((currentGroup.fecha_fin || currentGroup.fecha_inicio) + 'T12:00:00');
                const nextStart = new Date(e.fecha_inicio + 'T12:00:00');
                const diffDays = Math.round((nextStart - lastEnd) / (1000 * 60 * 60 * 24));
                
                // Criterios de agrupación: consecutivo, mismo tipo, mismo hotel, mismo sustituto, mismo estado
                const sameType = (currentGroup.tipo || '').split(' ')[0] === (e.tipo || '').split(' ')[0];
                const sameHotel = currentGroup.hotel_origen === e.hotel_origen;
                const sameSust = (currentGroup.empleado_destino_id || currentGroup.sustituto_id) === (e.empleado_destino_id || e.sustituto_id);
                const sameState = (currentGroup.estado || 'activo') === (e.estado || 'activo');
                
                if (diffDays === 1 && sameType && sameHotel && sameSust && sameState) {
                    currentGroup.fecha_fin = e.fecha_fin || e.fecha_inicio;
                    currentGroup.ids.push(e.id);
                    currentGroup.isGroup = true;
                } else {
                    finalGroups.push(currentGroup);
                    currentGroup = { 
                        ...e, 
                        fecha_fin: e.fecha_fin || e.fecha_inicio, 
                        ids: [e.id],
                        isGroup: false 
                    };
                }
            }
        });
        if (currentGroup) finalGroups.push(currentGroup);
    });
    
    return [...finalGroups, ...others];
};

window.buildEmployeeProfileModel = (empleadoId, fechaReferencia) => {
    const DEFAULT_CONDICIONES = {
        vacaciones: { derechoAnual: 44, generadas: 0, usadas: 0, regularizacion: 0, saldo: 0 },
        descansos: { esperados: 0, reales: 0, diferencia: 0 },
        meta: { regularizacion: 0 }
    };

    const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empleadoId) || window.normalizeId(e.nombre) === window.normalizeId(empleadoId));
    if (!profile) return null;

    const refISO = String(fechaReferencia || window.isoDate(new Date()) || '').slice(0, 10);
    const mode = 'month';
    const eventos = window.eventosActivos || [];
    let baseIndex = null;

    const emp = {
        id: profile.id,
        nombre: profile.nombre,
        hotel: profile.hotel_id || 'Sin hotel',
        puesto: profile.puesto || 'Personal',
        tipo: profile.tipo || 'Fijo',
        estado: profile.estado || 'Activo',
        fechaAlta: profile.fecha_alta,
        fechaBaja: profile.fecha_baja,
        telefono: profile.telefono,
        email: profile.email,
        notas: profile.notas,
        activo: profile.activo,
        id_interno: profile.id_interno,
        vacaciones_anuales: profile.vacaciones_anuales || 44,
        ajuste_vacaciones_dias: profile.ajuste_vacaciones_dias || 0
    };

    // INTENTO DE RECUPERAR TURNOS BASE DESDE ÚLTIMA CONSULTA GLOBAL (Aislamiento)
    let excelSource = window._adminExcelEditableRows || window._adminExcelBaseOriginalRows || null;
    let fallbackRaw = window._lastRawTurnosBase || [];
    
    if (!excelSource && fallbackRaw.length > 0) {
        const bRows = [];
        fallbackRaw.forEach(r => {
            if (window.normalizeId(r.empleado_id) === window.normalizeId(emp.id)) {
                bRows.push({ empleadoId: r.empleado_id, fecha: r.fecha, turno: r.turno });
            }
        });
        if (bRows.length > 0 && window.buildIndices) {
            const built = window.buildIndices(window.empleadosGlobales || [], [], bRows);
            baseIndex = built.baseIndex;
        }
    }

    if (excelSource) {
        try {
            const hotelRows = excelSource[emp.hotel] || [];
            const baseRowsFlat = [];
            hotelRows.forEach(sRow => {
                if (window.normalizeId(sRow.empleadoId) !== window.normalizeId(emp.id)) return;
                const fechasSemana = window.getFechasSemana ? window.getFechasSemana(sRow.weekStart) : [];
                if (Array.isArray(sRow.values)) {
                    sRow.values.forEach((turno, idx) => {
                        const fecha = fechasSemana[idx];
                        if (fecha) baseRowsFlat.push({ empleadoId: sRow.empleadoId, fecha, turno: turno || null });
                    });
                }
            });
            if (baseRowsFlat.length > 0 && window.buildIndices) {
                const built = window.buildIndices(window.empleadosGlobales || [], [], baseRowsFlat);
                baseIndex = built.baseIndex;
            }
        } catch (e) { console.warn('[FICHA BASEINDEX ERROR]', e); }
    }
    
    if (!baseIndex && window._lastBaseIndex) baseIndex = window._lastBaseIndex;

    const condicionesRaw = window.calcularCondicionesEmpleado(emp.id);
    const condiciones = condicionesRaw || DEFAULT_CONDICIONES;

    const activeEvents = eventos.filter(ev => {
        const belongs = window.eventoPerteneceAEmpleado(ev, emp.id);
        const state = window.normalizeEstado(ev.estado);
        return belongs && state !== 'anulado';
    });

    const calendario = window.employeeCalendarRange(refISO, mode).map(fecha => {
        const res = window.resolveEmployeeDay({
            empleado: profile,
            empleadoId: emp.id,
            hotel: emp.hotel,
            fecha,
            eventos,
            baseIndex,
            allEvents: eventos,
            resolveId: resolveId
        });
        
        return {
            fecha,
            diaSemana: window.employeeDateLabel(fecha, { weekday: 'short' }).replace('.', '').toUpperCase(),
            turno: res.turno,
            turnoBase: res.turnoBase,
            cambio: res.cambio,
            incidencia: res.incidencia,
            sustitucion: !!res.sustituidoPor,
            detalle: res,
            outsideMonth: mode === 'month' && fecha.slice(0, 7) !== refISO.slice(0, 7)
        };
    });

    return {
        empleado: emp,
        calendario,
        resumen30d: {
            vacaciones: condiciones.vacaciones.usadas,
            cambios: activeEvents.filter(ev => /CAMBIO|INTERCAMBIO|REFUERZO/i.test(ev.tipo || '')).length
        },
        vacaciones: condiciones.vacaciones,
        descansos: condiciones.descansos,
        meta: condiciones.meta || DEFAULT_CONDICIONES.meta,
        eventosActivos: activeEvents,
        condiciones
    };
};

window.employeeProfileBadges = (model) => {
    const emp = model.empleado;
    const typeNorm = window.employeeNorm(emp.tipo);
    const status = window.employeeStatusMeta(emp.estado);
    const badges = [{ label: status.label, cls: status.cls }];
    if (model.eventosActivos.some(ev => /VAC/i.test(ev.tipo || ''))) badges.push({ label: 'Vacaciones', cls: 'vacaciones' });
    if (model.eventosActivos.some(ev => /BAJA|PERM/i.test(ev.tipo || ''))) badges.push({ label: 'Baja', cls: 'baja' });
    if (typeNorm.includes('sust') || model.calendario.some(d => d.sustitucion)) badges.push({ label: 'Sustituto', cls: 'sustituto' });
    if (typeNorm.includes('ocas')) badges.push({ label: 'Ocasional', cls: 'ocasional' });
    if (typeNorm.includes('apoyo')) badges.push({ label: 'Apoyo', cls: 'apoyo' });
    return badges.filter((b, idx, arr) => arr.findIndex(x => x.label === b.label) === idx);
};

window.employeeFieldSizeClass = (key, type) => {
    if (type === 'textarea') return 'span-12';
    if (key === 'id') return 'span-4';
    if (key === 'nombre') return 'span-8';
    if (key === 'hotel_id') return 'span-12';
    if (key === 'puesto') return 'span-6';
    if (['categoria', 'tipo_personal', 'contrato', 'estado_empresa', 'id_interno'].includes(key)) return 'span-6';
    if (['fecha_alta', 'fecha_baja'].includes(key)) return 'span-6';
    if (['telefono', 'email'].includes(key)) return 'span-6';
    return 'span-6';
};

window.renderEmployeeProfileField = ([label, value, key, type = 'text']) => {
    const editing = Boolean(window._employeeProfileEditing);
    const rawValue = value === null || typeof value === 'undefined' ? '' : String(value);
    const sizeClass = window.employeeFieldSizeClass(key, type);
    const iconMap = {
        id: 'id', nombre: 'person', hotel_id: 'hotel', puesto: 'briefcase', categoria: 'laboral',
        tipo_personal: 'profile', contrato: 'laboral', estado_empresa: 'status', fecha_alta: 'calendar',
        fecha_baja: 'calendar', telefono: 'phone', email: 'mail', activo: 'toggle', id_interno: 'id'
    };
    const iconKey = iconMap[key];
    const iconHtml = iconKey ? `<span class="field-icon">${window.employeeIcon(iconKey)}</span>` : '';

    if (!editing || !key) {
        return `
            <div class="emp-profile-field ${sizeClass}">
                <dt>${iconHtml} ${escapeHtml(label)}</dt>
                <dd>${window.employeeFormatNumber(value)}</dd>
            </div>
        `;
    }
    const common = `data-emp-field="${escapeHtml(key)}" data-emp-type="${escapeHtml(type)}"`;
    let inputHtml = '';
    
    if (key === 'hotel_id') {
        const hotels = window._employeeLineHotels || ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
        inputHtml = `
            <select ${common}>
                <option value="">Seleccionar hotel...</option>
                ${hotels.map(h => `<option value="${escapeHtml(h)}" ${h === rawValue ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('')}
            </select>
        `;
    } else if (key === 'tipo_personal') {
        const types = ['fijo', 'apoyo', 'ocasional', 'sustituto'];
        inputHtml = `
            <select ${common}>
                ${types.map(t => `<option value="${escapeHtml(t)}" ${t === rawValue ? 'selected' : ''}>${escapeHtml(t.charAt(0).toUpperCase() + t.slice(1))}</option>`).join('')}
            </select>
        `;
    } else if (key === 'estado_empresa') {
        const states = ['ACTIVO', 'BAJA'];
        inputHtml = `
            <select ${common}>
                ${states.map(s => `<option value="${escapeHtml(s)}" ${s === rawValue.toUpperCase() ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
            </select>
        `;
    } else if (type === 'boolean') {
        const normalized = window.employeeNorm(rawValue);
        inputHtml = `
            <select ${common}>
                <option value="true" ${normalized === 'si' || normalized === 'true' ? 'selected' : ''}>Si</option>
                <option value="false" ${normalized === 'no' || normalized === 'false' ? 'selected' : ''}>No</option>
            </select>
        `;
    } else if (type === 'textarea') {
        inputHtml = `<textarea ${common} rows="2">${escapeHtml(rawValue)}</textarea>`;
    } else {
        inputHtml = `<input ${common} type="${type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}" value="${escapeHtml(rawValue)}">`;
    }
    return `
        <label class="emp-profile-field editable ${sizeClass}">
            <span>${iconHtml} ${escapeHtml(label)}</span>
            ${inputHtml}
        </label>
    `;
};

window.employeeStatusMeta = (status) => {
    const s = String(status || 'Activo').toLowerCase();
    if (s.includes('baja')) return { label: 'Baja', cls: 'baja' };
    if (s.includes('vaca')) return { label: 'Vacaciones', cls: 'vacaciones' };
    if (s.includes('exced')) return { label: 'Excedencia', cls: 'excedencia' };
    return { label: 'Activo', cls: 'activo' };
};

window.employeeNorm = (val) => String(val || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

window.openEmployeeDayDetail = (fecha) => {
    console.log("Detalle de día:", fecha);
    // Podríamos abrir un mini-modal con los detalles técnicos del turno resuelto
};

window.renderEmployeeProfileCalendar = (model) => {
    const days = model.calendario || [];
    const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    
    return `
        <div class="emp-calendar-shell" style="background:var(--bg3); border-radius:18px; padding:15px; border:1px solid var(--border);">
            <div class="emp-calendar-week-head" style="display:grid; grid-template-columns:repeat(7, 1fr); text-align:center; margin-bottom:10px; font-size:0.65rem; font-weight:800; color:var(--text-dim);">
                ${weekdays.map(w => `<span>${w}</span>`).join('')}
            </div>
            <div class="emp-calendar-grid month" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px;">
                ${days.map(day => {
                    const label = window.employeeShiftLabel(day).replace('&mdash;', '-').replace('PENDIENTE DE ASIGNAR', '-').replace('Descanso', 'D');
                    const labelShort = label.length > 2 ? label.charAt(0) : label;
                    const isToday = day.fecha === window.isoDate(new Date());
                    
                    let statusClass = '';
                    if (day.incidencia) {
                        const type = window.normalizeTipo(day.incidencia.tipo);
                        if (type === 'VAC') statusClass = 'vac';
                        else if (type === 'BAJA' || type === 'IT') statusClass = 'baja';
                        else statusClass = 'event';
                    } else if (label === 'D' || label === 'Descanso') {
                        statusClass = 'descanso';
                    } else if (['M','T','N'].includes(labelShort.toUpperCase())) {
                        statusClass = labelShort.toLowerCase();
                    }

                    const cls = [
                        'emp-cal-cell',
                        day.outsideMonth ? 'outside' : '',
                        isToday ? 'today' : '',
                        statusClass ? 'st-' + statusClass : '',
                        day.cambio ? 'has-change' : '',
                        day.sustitucion ? 'is-sust' : ''
                    ].filter(Boolean).join(' ');

                    return `
                        <div class="${cls}" onclick="window.openEmployeeDayDetail('${day.fecha}')" title="${day.fecha}: ${label}" style="aspect-ratio:1/1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:8px; cursor:pointer; position:relative; font-size:0.75rem; border:1px solid transparent;">
                            <span class="day-num" style="font-size:0.6rem; opacity:0.5; position:absolute; top:2px; right:4px;">${day.fecha.split('-')[2]}</span>
                            <span class="shift-tag" style="font-weight:900;">${labelShort}</span>
                            ${day.icon ? `<span style="position:absolute; bottom:2px; left:2px; font-size:0.6rem;">${day.icon}</span>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
};

window.toggleEmployeeSupportFields = (type) => {
    const reduced = ['apoyo', 'ocasional'].includes(String(type || '').toLowerCase());
    document.querySelectorAll('[data-balance-field]').forEach(el => { el.hidden = reduced; });
    const note = document.getElementById('supportReducedNotice');
    if (note) note.hidden = !reduced;
};
window.renderEmployeeProfileEditForm = (emp, model) => {
    const currentEstado = emp.estado_empresa || emp.estado || (emp.activo === false ? 'Baja' : 'Activo');
    const currentTipo = emp.tipo_personal || emp.contrato || emp.tipo || 'fijo';
    const currentHotel = emp.hotel_id || emp.hotel || '';
    const assignedHotelsRaw = Array.isArray(emp.hoteles_asignados) ? emp.hoteles_asignados : (typeof emp.hoteles_asignados === 'string' ? emp.hoteles_asignados.split(/[,;|]/).map(h => h.trim()).filter(Boolean) : []);
    const assignedHotels = new Set(assignedHotelsRaw.length ? assignedHotelsRaw : (currentHotel ? [currentHotel] : []));
    const isReducedSupport = ['apoyo', 'ocasional'].includes(String(currentTipo).toLowerCase());
    const currentRole = window.employeeConfiguredRole ? window.employeeConfiguredRole(emp) : (emp.rol_operativo || emp.rol || 'titular');
    return `
        <section class="emp-card glass emp-edit-card" style="padding:20px; border-radius:18px; border:1px solid var(--border);">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px;">
                <div>
                    <h3 style="margin:0; font-size:0.95rem; font-weight:900; color:var(--text);">Datos de ficha</h3>
                    <div style="margin-top:4px; font-size:0.74rem; color:var(--text-dim); font-weight:700;">El identificador interno queda bloqueado para preservar la integridad del cuadrante.</div>
                </div>
                <span class="emp-id-lock"><i class="fas fa-lock"></i> ${escapeHtml(emp.id_interno || emp.id || 'Sin ID')}</span>
            </div>
            <form class="emp-edit-form" onsubmit="window.saveEmployeeProfileInline(event)">
                <label><span>ID interno</span><input type="text" value="${escapeHtml(emp.id_interno || '')}" disabled><small>No editable</small></label>
                <label><span>ID t&eacute;cnico</span><input type="text" value="${escapeHtml(emp.id || '')}" disabled><small>Clave de sistema</small></label>
                <label><span>Nombre</span><input id="edit-emp-nombre" type="text" value="${escapeHtml(emp.nombre || '')}"></label>
                <label><span>Puesto</span><input id="edit-emp-puesto" type="text" value="${escapeHtml(emp.puesto || emp.categoria || '')}"></label>
                <label><span>Hotel principal</span><select id="edit-emp-hotel">
                    <option value="">Seleccionar</option>
                    <option value="Cumbria Spa&Hotel" ${currentHotel === 'Cumbria Spa&Hotel' ? 'selected' : ''}>Cumbria Spa&Hotel</option>
                    <option value="Sercotel Guadiana" ${currentHotel === 'Sercotel Guadiana' ? 'selected' : ''}>Sercotel Guadiana</option>
                </select></label>
                <label><span>Tipo</span><select id="edit-emp-tipo" onchange="window.toggleEmployeeSupportFields?.(this.value)">
                    ${['fijo', 'apoyo', 'ocasional', 'sustituto'].map(tipo => `<option value="${tipo}" ${String(currentTipo).toLowerCase() === tipo ? 'selected' : ''}>${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</option>`).join('')}
                </select></label>
                <label class="emp-role-field"><span>Rol</span><select id="edit-emp-rol">
                    ${window.employeeRoleOptionsHTML(currentRole)}
                </select><small>Funci&oacute;n base para el control operativo.</small></label>
                <fieldset class="emp-hotel-assignment span-2">
                    <legend>Hoteles asignados</legend>
                    <label><input type="checkbox" name="edit-emp-hoteles" value="Cumbria Spa&Hotel" ${assignedHotels.has('Cumbria Spa&Hotel') ? 'checked' : ''}> <span>Cumbria Spa&Hotel</span></label>
                    <label><input type="checkbox" name="edit-emp-hoteles" value="Sercotel Guadiana" ${assignedHotels.has('Sercotel Guadiana') ? 'checked' : ''}> <span>Sercotel Guadiana</span></label>
                    <small>Marca ambos si el empleado trabaja en los dos hoteles.</small>
                </fieldset>
                <label><span>Estado laboral</span><select id="edit-emp-estado">
                    ${['Activo', 'Baja', 'Excedencia'].map(estado => `<option value="${estado}" ${currentEstado === estado ? 'selected' : ''}>${estado}</option>`).join('')}
                </select></label>
                <label><span>Email</span><input id="edit-emp-email" type="email" value="${escapeHtml(emp.email || '')}"></label>
                <label><span>Tel&eacute;fono</span><input id="edit-emp-telefono" type="text" value="${escapeHtml(emp.telefono || '')}"></label>
                <div id="supportReducedNotice" class="emp-support-note span-2" ${isReducedSupport ? '' : 'hidden'}>Personal de apoyo/ocasional: ficha reducida. No computa vacaciones ni descansos pendientes.</div>
                <label data-balance-field ${isReducedSupport ? 'hidden' : ''}><span>Vacaciones/a&ntilde;o</span><input id="edit-emp-vac-anuales" type="number" min="0" step="1" value="${escapeHtml(emp.vacaciones_anuales || model?.vacaciones?.derechoAnual || 44)}"></label>
                <label data-balance-field ${isReducedSupport ? 'hidden' : ''}><span>Ajuste vacaciones</span><input id="edit-emp-vac-ajuste" type="number" step="1" value="${escapeHtml(emp.ajuste_vacaciones_dias || 0)}"></label>
                <label class="span-2"><span>Observaciones</span><textarea id="edit-emp-observaciones" rows="3">${escapeHtml(emp.observaciones || emp.notas || '')}</textarea></label>
                <div class="emp-edit-actions span-2">
                    <span id="empProfileSaveStatus">El ID no se modifica en este formulario.</span>
                    <button type="submit" class="emp-save-btn">Guardar cambios</button>
                </div>
            </form>
        </section>
    `;
};
window.renderEmployeeProfile = () => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    const drawerHeader = drawer?.querySelector('.drawer-header');
    if (!drawer || !body) return;

    const currentTab = window._employeeProfileTab || 'overview';
    const refISO = window._employeeProfileDate || window.isoDate(new Date());
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, refISO);
    
    if (!model) {
        body.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;">Empleado no encontrado.</div>';
        return;
    }
    
    drawer.classList.add('open');
    const emp = model.emp;
    const refDate = new Date(`${refISO}T12:00:00`);
    const titlePeriod = refDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    // 1. CABECERA PREMIUM
    const headerHTML = `
        <div class="emp-premium-header">
            <div class="emp-header-info">
                <div class="emp-avatar" style="background:var(--accent); color:white; width:60px; height:60px; border-radius:18px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:800; box-shadow:0 8px 16px rgba(0,0,0,0.1);">
                    ${emp.nombre.charAt(0)}
                </div>
                <div class="emp-title-block">
                    <h2 style="margin:0; font-size:1.4rem; font-weight:800; color:var(--text);">${escapeHtml(emp.nombre)} <span style="font-size:0.8rem; opacity:0.5; font-weight:400; margin-left:8px;">${emp.id_interno || emp.id}</span></h2>
                    <div class="emp-subtitle" style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:var(--text-dim); margin-top:4px;">
                        <span>${emp.puesto || 'Recepcionista'}</span>
                        <i class="fas fa-circle" style="font-size:4px; opacity:0.3;"></i> 
                        <span>${emp.hotel || 'Hotel no definido'}</span>
                        <i class="fas fa-circle" style="font-size:4px; opacity:0.3;"></i> 
                        <span class="status-pill ${window.employeeStatusMeta(emp.estado).cls}">${window.employeeStatusMeta(emp.estado).label}</span>
                    </div>
                </div>
            </div>
            <div class="emp-header-actions">
                <button class="btn-premium" onclick="window.setEmployeeProfileTab('config')" style="background:var(--accent); color:white; border:none; padding:10px 20px; border-radius:12px; font-weight:700; cursor:pointer; font-size:0.8rem;">
                    <i class="fas fa-user-edit" style="margin-right:6px;"></i> Editar ficha
                </button>
            </div>
        </div>
    `;

    const tabsNav = `
        <div class="emp-tabs-nav" style="display:flex; gap:20px; border-bottom:1px solid var(--border); margin-bottom:24px; padding-bottom:2px;">
            <button class="emp-tab-btn ${currentTab === 'overview' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('overview')" style="background:none; border:none; padding:10px 5px; color:var(--text-dim); font-weight:700; cursor:pointer; font-size:0.85rem; position:relative;">Vista General</button>
            <button class="emp-tab-btn ${currentTab === 'planning' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('planning')" style="background:none; border:none; padding:10px 5px; color:var(--text-dim); font-weight:700; cursor:pointer; font-size:0.85rem; position:relative;">Planificaci&oacute;n</button>
            <button class="emp-tab-btn ${currentTab === 'config' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('config')" style="background:none; border:none; padding:10px 5px; color:var(--text-dim); font-weight:700; cursor:pointer; font-size:0.85rem; position:relative;">Datos y Config</button>
            <button class="emp-tab-btn ${currentTab === 'history' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('history')" style="background:none; border:none; padding:10px 5px; color:var(--text-dim); font-weight:700; cursor:pointer; font-size:0.85rem; position:relative;">Historial</button>
            <button class="emp-tab-btn ${currentTab === 'vacations' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('vacations')" style="background:none; border:none; padding:10px 5px; color:var(--text-dim); font-weight:700; cursor:pointer; font-size:0.85rem; position:relative;">Control Vacaciones</button>
        </div>
    `;

    if (drawerHeader) {
        drawerHeader.innerHTML = `
            <div class="emp-drawer-topbar" style="display:flex; align-items:center; justify-content:space-between; gap:16px; padding:22px 34px 16px;">
                <h3 id="drawerTitle" style="margin:0; font-size:0.98rem; font-weight:800; color:var(--text);">Detalle Empleado</h3>
                <button class="btn-close-drawer" onclick="window.closeEmpDrawer()" aria-label="Cerrar" style="margin-left:auto;">&times;</button>
            </div>
            ${tabsNav}
        `;
    }

    // 2. RESUMEN KPI (SIEMPRE VISIBLE)
    const kpiHTML = `
        <div class="emp-kpi-grid" style="display:grid; grid-template-columns:repeat(6, 1fr); gap:12px; margin-bottom:24px;">
            <div class="emp-kpi-card glass" style="padding:15px; border-radius:18px; border:1px solid var(--border);">
                <label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Estado Hoy</label>
                <strong style="font-size:1rem; color:var(--text);">${model.hoy ? window.employeeShiftLabel(model.hoy) : '-'}</strong>
            </div>
            <div class="emp-kpi-card glass" style="padding:15px; border-radius:18px; border:1px solid var(--border);">
                <label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Hotel Actual</label>
                <strong style="font-size:1rem; color:var(--text);">${model.hotelActual || emp.hotel || '-'}</strong>
            </div>
            <div class="emp-kpi-card glass" style="padding:15px; border-radius:18px; border:1px solid var(--border);">
                <label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Saldo Pendiente</label>
                <strong style="font-size:1rem; color:#10b981;">${model.vacaciones.neto} d&iacute;as</strong>
            </div>
            <div class="emp-kpi-card glass" style="padding:15px; border-radius:18px; border:1px solid var(--border);">
                <label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Vacas. Usadas</label>
                <strong style="font-size:1rem; color:var(--text);">${model.vacaciones.usadas} / ${model.vacaciones.derechoAnual}</strong>
            </div>
            <div class="emp-kpi-card glass" style="padding:15px; border-radius:18px; border:1px solid var(--border);">
                <label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Vacas. Previstas</label>
                <strong style="font-size:1rem; color:var(--text);">${model.vacaciones.previstas}</strong>
            </div>
            <div class="emp-kpi-card glass" style="padding:15px; border-radius:18px; border:1px solid var(--border);">
                <label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Ajustes Saldo</label>
                <strong style="font-size:1rem; color:var(--text);">${model.vacaciones.saldo > 0 ? '+' : ''}${model.vacaciones.saldo}</strong>
            </div>
        </div>
    `;

    let tabContent = '';
    const today = window.isoDate(new Date());

    if (currentTab === 'overview') {
        tabContent = `
            <div style="display:grid; gap:20px;">
                <section class="emp-card glass" style="padding:24px; border-radius:24px; border:1px solid var(--border);">
                    <h3 style="margin-top:0; font-size:0.95rem; font-weight:800; color:var(--text); margin-bottom:18px;">Situaci&oacute;n Operativa</h3>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px;">
                        <div class="emp-ficha-field"><label>Ausencias registradas</label><div class="emp-ficha-field-value">${model.resumenGlobal.ausencias}</div></div>
                        <div class="emp-ficha-field"><label>Bajas</label><div class="emp-ficha-field-value">${model.resumenGlobal.bajas}</div></div>
                        <div class="emp-ficha-field"><label>Cambios de turno</label><div class="emp-ficha-field-value">${model.resumenGlobal.cambios}</div></div>
                        <div class="emp-ficha-field"><label>Descanso pendiente</label><div class="emp-ficha-field-value">${model.resumenGlobal.descansoPendiente}</div></div>
                        <div class="emp-ficha-field"><label>Descansos acumulados</label><div class="emp-ficha-field-value">${model.resumenGlobal.descansosReales} / ${model.resumenGlobal.descansosEsperados}</div></div>
                        <div class="emp-ficha-field"><label>Pr&oacute;ximos eventos</label><div class="emp-ficha-field-value">${model.resumenGlobal.proximosEventos}</div></div>
                    </div>
                </section>
                <div class="emp-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <section class="emp-card glass" style="padding:24px; border-radius:24px; border:1px solid var(--border);">
                        <h3 style="margin-top:0; font-size:0.95rem; font-weight:800; color:var(--text); margin-bottom:18px;">Lectura Global</h3>
                        <div style="display:grid; gap:12px;">
                            ${window.renderEmployeeProfileField(['Estado operativo hoy', model.hoy ? window.employeeShiftLabel(model.hoy) : 'No definido'])}
                            ${window.renderEmployeeProfileField(['Hotel operativo actual', model.hotelActual || emp.hotel])}
                            ${window.renderEmployeeProfileField(['Saldo vacacional neto', `${model.vacaciones.neto} d&iacute;as`])}
                            ${window.renderEmployeeProfileField(['Vacaciones previstas', `${model.vacaciones.previstas} d&iacute;as`])}
                        </div>
                    </section>
                    <section class="emp-card glass" style="padding:24px; border-radius:24px; border:1px solid var(--border);">
                        <h3 style="margin-top:0; font-size:0.95rem; font-weight:800; color:var(--text); margin-bottom:18px;">Detalle Contractual</h3>
                        <div style="display:grid; gap:12px;">
                            ${window.renderEmployeeProfileField(['Categor&iacute;a', emp.puesto])}
                            ${window.renderEmployeeProfileField(['Tipo de Contrato', emp.tipo])}
                            ${window.renderEmployeeProfileField(['Centro de Trabajo', emp.hotel])}
                        </div>
                    </section>
                </div>
                <div class="emp-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <section class="emp-card glass" style="padding:24px; border-radius:24px; border:1px solid var(--border);">
                        <h3 style="margin-top:0; font-size:0.95rem; font-weight:800; color:var(--text); margin-bottom:18px;">Informaci&oacute;n Personal</h3>
                        <div style="display:grid; gap:12px;">
                            ${window.renderEmployeeProfileField(['Email Corporativo', emp.email])}
                            ${window.renderEmployeeProfileField(['Tel&eacute;fono de Contacto', emp.telefono])}
                            ${window.renderEmployeeProfileField(['Fecha de Alta', window.fmtDateLegacy(emp.fechaAlta)])}
                        </div>
                    </section>
                    <section class="emp-card glass" style="padding:24px; border-radius:24px; border:1px solid var(--border);">
                        <h3 style="margin-top:0; font-size:0.95rem; font-weight:800; color:var(--text); margin-bottom:18px;">Descanso y Balance</h3>
                        <div style="display:grid; gap:12px;">
                            ${window.renderEmployeeProfileField(['Objetivo descanso semanal', '2 d&iacute;as / semana'])}
                            ${window.renderEmployeeProfileField(['Diferencia acumulada', `${model.descansos.diferencia > 0 ? '+' : ''}${model.descansos.diferencia || 0}`])}
                            ${window.renderEmployeeProfileField(['Ajuste manual de saldo', `${model.vacaciones.saldo > 0 ? '+' : ''}${model.vacaciones.saldo}`])}
                        </div>
                    </section>
                </div>
            </div>
        `;
    } else if (currentTab === 'planning') {
        const rawProximos = model.eventosActivos.filter(ev => (ev.fecha_fin || ev.fecha_inicio) >= today);
        const proximos = window.groupConsecutiveEvents(rawProximos).sort((a,b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
        
        tabContent = `
            <div class="emp-grid" style="display:grid; grid-template-columns: 1fr 400px; gap:24px; align-items:start;">
                <section class="emp-card glass" style="padding:20px; border-radius:24px; border:1px solid var(--border);">
                    <h3 style="margin-top:0; font-size:0.95rem; font-weight:800; color:var(--text); margin-bottom:18px;">Pr&oacute;ximos Eventos y Planificaci&oacute;n</h3>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px;">
                        ${proximos.length > 0 ? proximos.slice(0, 12).map(ev => {
                            const isVac = ev.tipo.includes('VAC');
                            const isBaja = ev.tipo.includes('BAJA') || ev.tipo.includes('IT');
                            const accent = isVac ? '#2563eb' : (isBaja ? '#ef4444' : '#f59e0b');
                            const days = Math.round((new Date((ev.fecha_fin || ev.fecha_inicio) + 'T12:00:00') - new Date(ev.fecha_inicio + 'T12:00:00')) / 86400000) + 1;
                            
                            return `
                                <div style="padding:14px; background:white; border-radius:18px; border:1px solid var(--border); border-top:4px solid ${accent}; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                                    <div style="font-weight:900; font-size:0.7rem; color:${accent}; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">${ev.tipo} ${ev.isGroup ? '(Agrupado)' : ''}</div>
                                    <div style="font-weight:800; font-size:0.9rem; color:var(--text); margin-bottom:4px;">${window.fmtDateLegacy(ev.fecha_inicio)}${ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio ? ` — ${window.fmtDateLegacy(ev.fecha_fin)}` : ''}</div>
                                    <div style="font-size:0.7rem; color:var(--text-dim); font-weight:700;">${days} D&Iacute;A${days > 1 ? 'S' : ''} NATURALES</div>
                                    <div style="margin-top:8px; font-size:0.7rem; font-style:italic; color:var(--text-dim); border-top:1px solid #f1f5f9; padding-top:8px;">${ev.observaciones || 'Sin detalles'}</div>
                                </div>
                            `;
                        }).join('') : '<div style="grid-column:1/-1; padding:60px; text-align:center; opacity:0.4; font-size:0.8rem;">No hay eventos planificados.</div>'}
                    </div>
                </section>
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <section class="emp-card glass" style="padding:20px; border-radius:24px; border:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <h3 style="margin:0; font-size:0.95rem; font-weight:800;">Navegaci&oacute;n</h3>
                            <div style="display:flex; gap:5px;">
                                <button onclick="window.moveEmployeeProfilePeriod(-1)" class="btn-premium" style="padding:6px 10px;"><i class="fas fa-chevron-left"></i></button>
                                <button onclick="window.moveEmployeeProfilePeriod(1)" class="btn-premium" style="padding:6px 10px;"><i class="fas fa-chevron-right"></i></button>
                            </div>
                        </div>
                        <div style="text-align:center; margin-bottom:15px; font-weight:800; color:var(--accent); text-transform:capitalize;">${titlePeriod}</div>
                        ${window.renderEmployeeProfileCalendar(model)}
                    </section>
                </div>
            </div>
        `;
    } else if (currentTab === 'history') {
        const pasados = (model.groupedEvents || []).filter(ev => (ev.fecha_fin || ev.fecha_inicio) < today).sort((a,b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
        const pasadosAgrupados = Object.values(pasados.reduce((acc, ev) => {
            const key = ev.evento_id || ev.id || `${ev.fecha_inicio}_${ev.fecha_fin || ev.fecha_inicio}_${ev.tipo}`;
            if (!acc[key]) acc[key] = { ...ev, items: [ev] };
            else acc[key].items.push(ev);
            return acc;
        }, {}));
        
        tabContent = `
            <section class="emp-card glass" style="padding:24px; border-radius:24px; border:1px solid var(--border);">
                <h3 style="margin-top:0; font-size:0.95rem; font-weight:800; color:var(--text); margin-bottom:18px;">Historial de Eventos Pasados</h3>
                <div style="display:grid; gap:10px;">
                    ${pasadosAgrupados.length > 0 ? pasadosAgrupados.map(ev => `
                        <div style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; padding:14px 16px; border:1px solid var(--border); border-radius:16px; background:rgba(255,255,255,0.9);">
                            <div>
                                <div style="font-weight:800; font-size:0.84rem; color:var(--text);">${ev.tipo} ${ev.isGroup ? '(Agrupado)' : ''}</div>
                                <span style="margin-left:10px; font-size:0.75rem; color:var(--text-dim);">${window.fmtDateLegacy(ev.fecha_inicio)}${ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio ? ` — ${window.fmtDateLegacy(ev.fecha_fin)}` : ''}</span>
                            </div>
                            <div style="font-size:0.8rem; font-weight:600; color:${ev.estado === 'anulado' ? '#ef4444' : '#10b981'};">${ev.estado || 'Finalizado'}</div>
                        </div>
                    `).join('') : '<div style="padding:40px; text-align:center; opacity:0.4;">Sin registros históricos.</div>'}
                </div>
            </section>
        `;
    } else if (currentTab === 'vacations') {
        const vacs = (model.groupedVacs || []).sort((a,b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
        
        tabContent = `
            <div style="display:grid; grid-template-columns: 1fr 300px; gap:24px;">
                <section class="emp-card glass" style="padding:24px; border-radius:24px; border:1px solid var(--border);">
                    <h3 style="margin-top:0; font-size:0.95rem; font-weight:800; color:var(--text); margin-bottom:18px;">Periodos de Vacaciones</h3>
                    <div style="display:grid; gap:10px;">
                        ${vacs.length > 0 ? vacs.map(ev => {
                            const days = Math.round((new Date((ev.fecha_fin || ev.fecha_inicio) + 'T12:00:00') - new Date(ev.fecha_inicio + 'T12:00:00')) / 86400000) + 1;
                            return `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:var(--bg2); border-radius:15px; border:1px solid var(--border);">
                                    <div>
                                        <div style="font-weight:800; font-size:0.9rem;">${window.fmtDateLegacy(ev.fecha_inicio)}${ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio ? ` — ${window.fmtDateLegacy(ev.fecha_fin)}` : ''}</div>
                                        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:3px;">${days} d&iacute;as naturales ${ev.isGroup ? '(Agrupados)' : ''}</div>
                                    </div>
                                    <span class="status-pill ${ev.estado === 'activo' ? 'activo' : 'baja'}">${ev.estado || 'activo'}</span>
                                </div>
                            `;
                        }).join('') : '<div style="padding:60px; text-align:center; opacity:0.4;">No hay periodos de vacaciones registrados este año.</div>'}
                    </div>
                </section>
                <section class="emp-card glass" style="padding:20px; border-radius:24px; border:1px solid var(--border); background:rgba(37,99,235,0.05);">
                    <h4 style="margin:0 0 15px; font-size:0.8rem; font-weight:800; text-transform:uppercase; color:var(--accent);">Desglose del Saldo</h4>
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span>Derecho Anual:</span> <strong>${model.vacaciones.derechoAnual} d&iacute;as</strong></div>
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span>Consumidas:</span> <strong style="color:#ef4444;">- ${model.vacaciones.usadas} d&iacute;as</strong></div>
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span>Previstas:</span> <strong style="color:#2563eb;">${model.vacaciones.previstas} d&iacute;as</strong></div>
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span>Ajustes:</span> <strong>${model.vacaciones.saldo >= 0 ? '+' : ''}${model.vacaciones.saldo} d&iacute;as</strong></div>
                            <div style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; font-weight:800; font-size:1rem; color:#10b981;">
                                <span>Saldo Neto:</span>
                                <span>${model.vacaciones.neto} d&iacute;as</span>
                            </div>
                        </div>
                    </section>
            </div>
        `;
    } else if (currentTab === 'config') {
        tabContent = `
            <div class="emp-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div class="span-6">
                    <div class="emp-profile-field"><label>Nombre Completo</label><input type="text" id="edit-emp-nombre" value="${emp.nombre || ''}" class="btn-premium" style="width:100%; margin-top:5px;"></div>
                    <div class="emp-profile-field" style="margin-top:15px;"><label>Email</label><input type="email" id="edit-emp-email" value="${emp.email || ''}" class="btn-premium" style="width:100%; margin-top:5px;"></div>
                    <div class="emp-profile-field" style="margin-top:15px;"><label>Tel&eacute;fono</label><input type="text" id="edit-emp-telefono" value="${emp.telefono || ''}" class="btn-premium" style="width:100%; margin-top:5px;"></div>
                    <div class="emp-profile-field" style="margin-top:15px;"><label>Tipo de Contrato</label>
                        <select id="edit-emp-tipo" class="btn-premium" style="width:100%; margin-top:5px;">
                            ${['fijo', 'apoyo', 'ocasional', 'sustituto'].map(tipo => `<option value="${tipo}" ${(emp.tipo || '').toLowerCase() === tipo ? 'selected' : ''}>${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="emp-profile-field" style="margin-top:15px;"><label>D&iacute;as Vacaciones/A&ntilde;o</label><input type="number" id="edit-emp-vac-anuales" value="${emp.vacaciones_anuales || 44}" class="btn-premium" style="width:100%; margin-top:5px;"></div>
                    <div class="emp-profile-field" style="margin-top:15px;"><label>Ajuste Saldo (D&iacute;as)</label><input type="number" id="edit-emp-vac-ajuste" value="${emp.ajuste_vacaciones_dias || 0}" class="btn-premium" style="width:100%; margin-top:5px;"></div>
                </div>
                <div class="span-6">
                    <div class="emp-profile-field"><label>Categor&iacute;a / Puesto</label><input type="text" id="edit-emp-puesto" value="${emp.puesto || ''}" class="btn-premium" style="width:100%; margin-top:5px;"></div>
                    <div class="emp-profile-field" style="margin-top:15px;"><label>Hotel Principal</label>
                        <select id="edit-emp-hotel" class="btn-premium" style="width:100%; margin-top:5px;">
                            <option value="">- Seleccionar -</option>
                            <option value="Cumbria Spa&Hotel" ${emp.hotel === 'Cumbria Spa&Hotel' ? 'selected' : ''}>Cumbria Spa&Hotel</option>
                            <option value="Sercotel Guadiana" ${emp.hotel === 'Sercotel Guadiana' ? 'selected' : ''}>Sercotel Guadiana</option>
                        </select>
                    </div>
                    <div class="emp-profile-field" style="margin-top:15px;"><label>Estado Operativo</label>
                        <select id="edit-emp-estado" class="btn-premium" style="width:100%; margin-top:5px;">
                            <option value="Activo" ${emp.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                            <option value="Baja" ${emp.estado === 'Baja' ? 'selected' : ''}>Baja</option>
                            <option value="Excedencia" ${emp.estado === 'Excedencia' ? 'selected' : ''}>Excedencia</option>
                        </select>
                    </div>
                    <div class="emp-profile-field" style="margin-top:15px;"><label>ID Interno (Empresa)</label><input type="text" id="edit-emp-id-interno" value="${emp.id_interno || ''}" class="btn-premium" style="width:100%; margin-top:5px;"></div>
                </div>
                <div class="span-12" style="margin-top:20px;">
                    <button class="btn-publish-premium" onclick="window.saveEmployeeProfileInline()" style="width:auto; padding:14px 40px;">Guardar Cambios en Ficha</button>
                </div>
            </div>
        `;
    }

    body.innerHTML = `
        <div class="employee-profile-container" style="padding:10px;">
            ${headerHTML}
            ${kpiHTML}
            <div class="emp-content-area" style="min-height:400px;">
                ${tabContent}
            </div>
            <div style="margin-top:40px; padding-top:20px; border-top:1px solid var(--border); font-size:0.65rem; color:var(--text-dim); display:flex; justify-content:space-between;">
                <span>ID Técnico: ${emp.id}</span>
                <span>UUID: ${emp.uuid || 'N/A'}</span>
            </div>
        </div>
    `;
};

window.saveEmployeeProfileInline = async () => {
    const empId = window._employeeProfileId;
    const payload = {
        id: empId,
        nombre: $('#edit-emp-nombre').value,
        email: $('#edit-emp-email').value,
        telefono: $('#edit-emp-telefono').value,
        hotel: $('#edit-emp-hotel').value,
        hotel_id: $('#edit-emp-hotel').value,
        puesto: $('#edit-emp-puesto').value,
        tipo: $('#edit-emp-tipo').value,
        tipo_personal: $('#edit-emp-tipo').value,
        contrato: $('#edit-emp-tipo').value,
        estado: $('#edit-emp-estado').value,
        activo: $('#edit-emp-estado').value === 'Activo',
        id_interno: $('#edit-emp-id-interno').value,
        vacaciones_anuales: Number($('#edit-emp-vac-anuales').value || 44),
        ajuste_vacaciones_dias: Number($('#edit-emp-vac-ajuste').value || 0),
        updated_at: new Date().toISOString()
    };
    try {
        await window.TurnosDB.upsertEmpleado(payload);
        alert('Ficha de empleado actualizada correctamente.');
        // Recargar datos globales y refrescar UI
        if (window.populateEmployees) await window.populateEmployees();
        window.renderEmployeeProfile();
    } catch (e) {
        alert('Error al guardar: ' + e.message);
    }
};
// ==========================================
// 2. EXCEL SOURCE LOADER � delegado a excel-loader.js
// ==========================================
// La función loadExcelSourceRows() la provee window.ExcelLoader (excel-loader.js).
// window._sharedExcelSourceRows es la caché compartida con index y mobile.

// ==========================================
// 3. RENDER PREVIEW (WEEKLY / MONTHLY)
// ==========================================
window._previewMode = 'weekly';
window.switchPreviewMode = (mode) => {
    window._previewMode = mode;
    
    // UI Toggle
    const btnW = document.getElementById('btnViewWeekly');
    const btnM = document.getElementById('btnViewMonthly');
    if (btnW) btnW.classList.toggle('active', mode === 'weekly');
    if (btnM) btnM.classList.toggle('active', mode === 'monthly');
    
    window.DateManager.init();
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
    // 1. INICIALIZACIÓN DE DATOS BASE
    const baseRowsFlat = [];
    const puestosMap = new Map();
    const ausenciaSustitucionMap = new Map(); // normSustitutoId -> [{ titularId, normTitular, fi, ff }]

    // A) Construir baseRows y puestos para el índice
    sourceRows.forEach(sRow => {
        const puestoId = window.buildPuestoId(hotel, sRow.rowIndex);
        if (!puestosMap.has(puestoId)) {
            puestosMap.set(puestoId, {
                puesto_id: puestoId,
                hotel_id: hotel,
                rowIndex: sRow.rowIndex,
                label: `Puesto ${String((sRow.rowIndex || 0) + 1).padStart(2, '0')}`,
                excelLabel: String(sRow.displayName || sRow.empleadoId || '').trim(),
                asignaciones: {}
            });
        }
        
        dates.forEach((date, idx) => {
            const turno = sRow.values[idx] || null;
            baseRowsFlat.push({
                empleadoId: sRow.empleadoId,
                fecha: date,
                turno: turno
            });
            puestosMap.get(puestoId).asignaciones[date] = {
                puesto_id: puestoId,
                hotel_id: hotel,
                fecha: date,
                turno_base: turno,
                titular_id: sRow.empleadoId
            };
        });
    });

    // --- IDENTITY REGISTRY (V12.5 Profile-First Normalization) ---
    const idMap = new Map(); // Normalized ID -> Canonical UUID
    const nameToIds = new Map(); // Normalized Name -> Set of Canonical UUIDs
    employees.forEach(e => {
        const canonicalId = e.id;
        const normId = window.normalizeId(e.id);
        const normName = window.normalizeId(e.nombre);
        idMap.set(normId, canonicalId);
        if (!nameToIds.has(normName)) nameToIds.set(normName, new Set());
        nameToIds.get(normName).add(canonicalId);
    });

    const resolveId = (raw) => {
        if (!raw) return null;
        const norm = window.normalizeId(raw);
        if (idMap.has(norm)) return idMap.get(norm);
        const ids = nameToIds.get(norm);
        if (ids && ids.size === 1) return Array.from(ids)[0];
        return raw; 
    };

    const getDisplayName = (id, rowRaw = null) => {
        const canonicalId = resolveId(id);
        const norm = window.normalizeId(canonicalId);
        const profile = employees.find(e => window.normalizeId(e.id) === norm || window.normalizeId(e.nombre) === norm);
        
        return (
            profile?.display_name ||
            profile?.nombre ||
            profile?.name ||
            rowRaw?.displayName ||
            rowRaw?.nombre ||
            (id && !String(id).includes('-') ? id : (rowRaw?.empleadoId || id))
        );
    };

    // B) Construir mapa de sustituciones por ausencia (VAC, BAJA, PERMISO, FORMACION)
    eventos.forEach(ev => {
        const tipo = window.normalizeTipo(ev.tipo);
        if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION'].includes(tipo)) return;
        if (window.normalizeEstado(ev.estado) === 'anulado') return;
        if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

        const sustitutoRaw = ev.empleado_destino_id || ev.sustituto_id ||
            ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto || ev.payload?.sustituto_nombre;
        if (!sustitutoRaw) return;

        const titularRaw = ev.empleado_id;
        if (!titularRaw) return;

        const normSust = window.normalizeId(sustitutoRaw);
        const fi = window.normalizeDate(ev.fecha_inicio);
        const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);

        const normTitularChk = resolveId(titularRaw);
        const titularRowMatch = sourceRows.find(r => resolveId(r.empleadoId) === normTitularChk);
        if (!titularRowMatch) return;

        const titularIdReal = titularRowMatch.empleadoId;
        const normTitularReal = window.normalizeId(titularIdReal);

        if (!ausenciaSustitucionMap.has(normSust)) {
            ausenciaSustitucionMap.set(normSust, []);
        }
        ausenciaSustitucionMap.get(normSust).push({
            titularId: titularIdReal,
            normTitular: normTitularReal,
            sustitutoRaw,
            fi,
            ff
        });
    });

    // 2. CONSTRUIR ÍNDICE GLOBAL (con visibilidad de sustituciones)
    const { baseIndex } = window.buildIndices(employees, eventos, baseRowsFlat);
    baseIndex.ausenciaSustitucionMap = ausenciaSustitucionMap;

    const puestos = Array.from(puestosMap.values()).sort((a, b) => {
        const valA = a.rowIndex === null || a.rowIndex === undefined ? 99999 : a.rowIndex;
        const valB = b.rowIndex === null || b.rowIndex === undefined ? 99999 : b.rowIndex;
        return valA - valB;
    });

    // Re-mapear el puestoOrden visual para que sea correlativo 1..N según el orden final
    puestos.forEach((p, idx) => {
        p.puestoOrden = idx + 1;
    });

    // 3. FUNCIONES DE RESOLUCIÓN

    const getCelda = (puestoId, fecha) => {
        const puesto = puestosMap.get(puestoId);
        if (!puesto) return null;
        const asig = puesto.asignaciones[fecha];
        if (!asig) return null;

        const res = window.resolveEmployeeDay({
            empleado: employees.find(e => window.normalizeId(e.id) === window.normalizeId(asig.titular_id) || window.normalizeId(e.nombre) === window.normalizeId(asig.titular_id)),
            empleadoId: asig.titular_id,
            hotel,
            fecha,
            turnoBase: asig.turno_base,
            eventos,
            baseIndex,
            allEvents: eventos,
            resolveId: resolveId
        });

        return {
            turno: res.turno,
            titular: getDisplayName(asig.titular_id),
            real: getDisplayName(res.empleadoId),
            incidencia: res.incidencia,
            puesto_id: puestoId,
            hotel_id: hotel,
            fecha,
            turno_base: res.turnoBase,
            titular_id: asig.titular_id,
            real_id: res.empleadoId,
            cobertura: !!res.sustitutoId || (res.empleadoId !== asig.titular_id),
            cambio: res.cambio,
            intercambio: res.intercambio,
            _finalState: res
        };
    };

    const baseGetTurnoEmpleado = (empleadoId, fecha) => {
        const normEmpId = window.normalizeId(empleadoId);
        const profile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
        const titularRow = sourceRows.find(r => window.normalizeId(r.empleadoId) === normEmpId);
        const dateIdx = dates.indexOf(fecha);
        const turnoBase = (titularRow && dateIdx !== -1) ? (titularRow.values[dateIdx] || null) : null;
        
        return window.resolveEmployeeDay({
            empleado: profile || { id: empleadoId, nombre: getDisplayName(empleadoId) },
            empleadoId,
            hotel,
            fecha,
            turnoBase,
            eventos,
            baseIndex,
            allEvents: eventos,
            resolveId: resolveId
        });
    };

    const getTurnoEmpleadoExtended = (empleadoId, fecha) => {
        const normEmpId = window.normalizeId(empleadoId);
        if (ausenciaSustitucionMap.has(normEmpId)) {
            const coberturas = ausenciaSustitucionMap.get(normEmpId);
            for (const cob of coberturas) {
                if (fecha >= cob.fi && fecha <= cob.ff) {
                    const titularRow = sourceRows.find(r => window.normalizeId(r.empleadoId) === cob.normTitular);
                    const dateIdx = dates.indexOf(fecha);
                    const turnoBase = (titularRow && dateIdx !== -1) ? (titularRow.values[dateIdx] || null) : null;
                    const profile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
                    
                    const res = window.resolveEmployeeDay({
                        empleado: profile || { id: empleadoId, nombre: getDisplayName(empleadoId) },
                        empleadoId,
                        hotel,
                        fecha,
                        turnoBase,
                        eventos,
                        baseIndex,
                        allEvents: eventos,
                        resolveId: resolveId
                    });

                    const shouldKeepResolvedTurno = res.intercambio || res.origen === 'CAMBIO_TURNO' || res.origen === 'INTERCAMBIO_TURNO';
                    const turnoOperativo = shouldKeepResolvedTurno ? res.turno : (turnoBase || res.turno);

                    const finalRes = {
                        ...res,
                        turno: res.incidencia ? res.turno : turnoOperativo,
                        turnoFinal: res.incidencia ? res.turno : turnoOperativo,
                        rol: 'sustituto',
                        sustitucion: true,
                        titular: cob.titularId,
                        _finalState: res
                    };
                    return finalRes;
                }
            }
        }
        const res = baseGetTurnoEmpleado(empleadoId, fecha);
        return { ...res, _finalState: res };
    };

    const getEmployees = (viewType = 'weekly') => {
        const firstDate = dates[0] || '';
        const operationalRows = [];
        const absentRows = [];
        const extraRefuerzoRows = [];
        const assignedNorms = new Set(); // Empleados ya colocados en puestos operativos
        
        // 1. PRE-PROCESAR ESTADO DE LA SEMANA
        const weekStatus = new Map(); // normTitular -> { tipo, sustitutoId, ... }
        const substitutesMap = new Map(); // normSustituto -> { normTitular, ... } (para saber quién cubre a quién)
        
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION'].includes(tipo)) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const tId = ev.empleado_id || ev.titular_id || ev.participante_a || ev.empleado;
            if (!tId) return;
            const normT = resolveId(tId);
            
            let sRaw = window.getOtroEmpleadoDelCambio ? window.getOtroEmpleadoDelCambio(ev, tId) : null;
            if (!sRaw) {
                sRaw = ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto || ev.participante_b || ev.destino_id;
            }
            const normS = resolveId(sRaw);
            
            const existing = weekStatus.get(normT);
            if (existing && existing.sustitutoId && !sRaw) return;

            const statusData = { 
                tipo, 
                sustitutoId: normS, 
                rawSust: sRaw, 
                titularId: tId,
                event_id: ev.id,
                payload: ev.payload,
                meta: ev.meta
            };
            weekStatus.set(normT, statusData);
            if (normS) substitutesMap.set(normS, statusData);
        });

        // 2. PROCESAR FILAS EXCEL (ESTRUCTURA BASE)
        sourceRows.forEach(r => {
            if (!r.empleadoId || String(r.empleadoId).trim() === '') return;
            if (String(r.empleadoId || '').includes('---') || String(r.empleadoId || '').includes('___')) return;
            
            const normTitular = resolveId(r.empleadoId);
            const v9Order = window.getV9ExcelOrder(hotel, r.week_start || firstDate, r.empleadoId) || 500;
            const status = weekStatus.get(normTitular);

            // CASO A: TITULAR ESTÁ AUSENTE
            if (status) {
                const titularName = getDisplayName(r.empleadoId, r);
                absentRows.push({
                    ...r,
                    employee_id: r.empleadoId,
                    nombre: titularName,
                    nombreVisible: titularName,
                    isAbsentInformative: true,
                    rowType: 'ausencia_informativa',
                    puestoOrden: v9Order + 1000,
                    evento_id: status.event_id,
                    titularOriginalId: r.empleadoId
                });

                let occupantId = null;
                let isSustitucion = false;
                let isVacante = false;

                if (status.sustitutoId) {
                    occupantId = status.sustitutoId;
                    isSustitucion = true;
                } else {
                    occupantId = 'VACANTE-' + normTitular;
                    isVacante = true;
                }

                const normOcc = resolveId(occupantId);
                if (isSustitucion && assignedNorms.has(normOcc)) {
                    occupantId = 'VACANTE-' + normTitular;
                    isVacante = true;
                    isSustitucion = false;
                }

                const occName = isVacante ? 'VACANTE' : getDisplayName(occupantId, { nombre: status.rawSust });
                operationalRows.push({
                    ...r,
                    employee_id: occupantId,
                    empleadoId: occupantId,
                    nombre: occName,
                    nombreVisible: occName,
                    displayName: occName,
                    isVacante,
                    isSustitucion,
                    puestoOrden: v9Order,
                    rowType: 'operativo',
                    titularOriginal: titularName,
                    titularOriginalId: r.empleadoId,
                    evento_id: status.event_id
                });
                if (occupantId && !isVacante) assignedNorms.add(normOcc);

            } 
            // CASO B: TITULAR ESTÁ PRESENTE
            else {
                const statusInThisHotel = substitutesMap.get(normTitular);
                const isSubbingInThisHotel = statusInThisHotel && window.eventoPerteneceAHotel && window.eventoPerteneceAHotel(statusInThisHotel.payload || statusInThisHotel, hotel);

                if (isSubbingInThisHotel) return; 

                if (!assignedNorms.has(normTitular)) {
                    const titularName = getDisplayName(r.empleadoId, r);
                    operationalRows.push({
                        ...r,
                        employee_id: r.empleadoId,
                        empleadoId: r.empleadoId,
                        nombre: titularName,
                        nombreVisible: titularName,
                        displayName: titularName,
                        puestoOrden: v9Order,
                        rowType: 'operativo',
                        titularOriginal: titularName
                    });
                    assignedNorms.add(normTitular);
                }
            }
        });

        // 3. PROCESAR REFUERZOS EXPLÍCITOS
        eventos.forEach(ev => {
            const isExplicitRef = Boolean(ev.isRefuerzo === true || ev.origen === 'refuerzo' || ev.payload?.tipo_modulo === 'refuerzo' || ev.meta?.refuerzo === true);
            if (!isExplicitRef) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const empId = ev.empleado_id;
            if (!empId) return;
            const normEmpId = window.normalizeId(empId);
            if (assignedNorms.has(normEmpId)) return;

            const empName = getDisplayName(empId);
            extraRefuerzoRows.push({ 
                hotel, 
                employee_id: empId, 
                nombre: empName, 
                puestoOrden: 2000, 
                rowType: 'refuerzo',
                origenOrden: 'refuerzo_explicito',
                evento_id: ev.id
            });
            assignedNorms.add(normEmpId);
        });

        operationalRows.sort((a, b) => a.puestoOrden - b.puestoOrden);
        absentRows.sort((a, b) => a.puestoOrden - b.puestoOrden);
        extraRefuerzoRows.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        return [...operationalRows, ...absentRows, ...extraRefuerzoRows].filter(r => {
            const validId = r.employee_id && !String(r.employee_id).includes('---') && !String(r.employee_id).includes('___');
            const validName = r.nombre && r.nombre !== 'Empleado' && r.nombre.trim().length > 1;
            return validId && validName;
        });
    };

    return {
        hotel,
        dates,
        puestos,
        getPuesto: (id) => puestosMap.get(id),
        getCelda,
        getTurnoEmpleado: getTurnoEmpleadoExtended,
        getCeldaByEmpleado: getTurnoEmpleadoExtended, // Alias para facilitar publicación
        getEmployees,
        getEmpleadosVisibles: (start, end) => getEmployees(),
        estaDeVacaciones: (empId, fechas) => (fechas || []).some(f => getTurnoEmpleadoExtended(empId, f).incidencia === 'VAC'),
        ordenarEmpleados: (emps) => emps,
        getEmployeeName: (id) => getDisplayName(id)
    };
};
// --- DIAGNÓSTICO DEL MODELO (Solicitado por el usuario) ---
window.debugPreviewModel = () => {
    const models = Object.values(window._previewPuestosModels || {});
    if (!models.length) {
        console.warn("[DEBUG_PREVIEW] No hay modelos activos en window._previewPuestosModels");
        return null;
    }
    
    // Tomar el primer modelo como referencia o agrupar
    const report = {
        hoteles: [...new Set(models.map(m => m.hotel))],
        empleadosPorHotel: {},
        baseIndexKeys: window._lastBaseIndex ? window._lastBaseIndex.porEmpleadoFecha.size : 0,
        eventos: window._lastEventos ? window._lastEventos.length : 0
    };
    
    models.forEach(m => {
        if (!report.empleadosPorHotel[m.hotel]) {
            const emps = m.getEmployees();
            report.empleadosPorHotel[m.hotel] = emps.map(e => e.displayName || e.employee_id);
        }
    });
    
    console.log("[DEBUG_PREVIEW_REPORT]", report);
    if (window._lastBaseIndex) {
        console.log("[BASE_INDEX_SAMPLE]", Array.from(window._lastBaseIndex.porEmpleadoFecha.keys()).slice(0, 10));
    }
    
    return report;
};

window.buildPuestoCellTitle = (celda) => {
    const parts = [
        `Puesto: ${celda.puesto_id}`,
        `Base: ${celda.turno_base || '�'}`,
        `Titular: ${celda.titular || '�'}`
    ];

    if (celda.incidencia) parts.push(`Incidencia: ${celda.incidencia}`);
    if (celda.real && celda.real !== celda.titular) parts.push(`Real: ${celda.real}`);
    if (celda.cambio && celda.turno !== celda.turno_base) {
        parts.push(`Cambio: ${celda.turno_base || '�'} -> ${celda.turno || '�'}`);
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
                ${escapeHtml(celda.turno || celda.turno_base || '�')}
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

            if (celda.incidencia && !celda.cobertura && (!celda.real || celda.real === celda.titular)) {
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

            // --- 5. REACTIVAR DETECCI�N DE ERROR REAL ---
            if (celda.incidencia && celda.turno && celda.turno !== celda.incidencia) {
                const empleadoKey = celda.titular_id || celda.titular || '';
                const fechaNormalizada = String(fecha || '').slice(0, 10);
                const resultadoResolver = empleadoKey && previewModel.getTurnoEmpleado
                    ? previewModel.getTurnoEmpleado(empleadoKey, fechaNormalizada)
                    : null;
                 warnError({
                    tipo: 'incidencia_sin_efecto',
                    fecha,
                    puesto_id: puesto.puesto_id,
                    titular: celda.titular,
                    empleadoKey,
                    fechaNormalizada,
                    incidencia: celda.incidencia,
                    turno: celda.turno,
                    turnoFinal: celda.turno,
                    eventoEncontrado: celda._incidencia?.event || celda._incidencia || celda._finalState || null,
                    resultadoResolver
                });
            }

        });
    });

    if (errores.length > 0) {
        console.groupCollapsed(`[VALIDACION] ${previewModel.hotel} - ${errores.length} errores`);
        console.table(errores.map(e => ({
            tipo: e.tipo,
            fecha: e.fecha,
            empleado: e.empleado || e.titular || e.empleado_id,
            incidencia: e.incidencia,
            turnoFinal: e.turnoFinal || e.turno_final || e.resultado?.turno || e.resultadoResolver?.turno,
            puesto_id: e.puesto_id
        })));
        errores.forEach(error => {
            const detalleLog = {
                tipo: error?.tipo || error?.code || 'desconocido',
                mensaje: error?.mensaje || error?.message || '',
                fecha: error?.fecha || null,
                empleado: error?.empleado || error?.titular || error?.empleado_id || null,
                puesto_id: error?.puesto_id || null,
                incidencia: error?.incidencia || null,
                turno: error?.turno || null,
                turnoFinal: error?.turnoFinal || error?.turno_final || error?.resultado?.turno || error?.resultadoResolver?.turno || null,
                origen: error?.origen || null,
                raw: error
            };
            console.error('[VALIDACION ERROR]', {
                tipo: detalleLog.tipo,
                mensaje: `fecha=${detalleLog.fecha || ''} empleado=${detalleLog.empleado || ''} incidencia=${detalleLog.incidencia || ''} turnoFinal=${detalleLog.turnoFinal || ''} puesto_id=${detalleLog.puesto_id || ''} empleadoKey=${error?.empleadoKey || ''} fechaNormalizada=${error?.fechaNormalizada || ''} evento=${error?.eventoEncontrado?.tipo || error?.eventoEncontrado?.sourceReason || ''} resultadoTurno=${error?.resultadoResolver?.turno || ''} resultadoIncidencia=${error?.resultadoResolver?.incidencia || ''}`,
                fecha: detalleLog.fecha,
                empleado: detalleLog.empleado,
                puesto_id: detalleLog.puesto_id,
                incidencia: detalleLog.incidencia,
                turnoFinal: detalleLog.turnoFinal,
                raw: error
            });
        });
        console.groupEnd();
    }

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
    if (!turnoEmpleado) return '�';
    if (turnoEmpleado.conflicto) return 'Conflicto';
    if (turnoEmpleado.incidencia === 'VAC') return 'Vacaciones';
    if (turnoEmpleado.incidencia === 'BAJA') return 'Baja';
    if (turnoEmpleado.incidencia === 'PERM') return 'Permiso';

    const key = window.TurnosRules?.shiftKey(turnoEmpleado.turno || '', 'NORMAL') || '';
    return window.TurnosRules?.definitions?.[key]?.label || turnoEmpleado.turno || '—';
};

window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false, isCompact = false } = {}) => {
    const rawName = employee?.nombre || employee?.displayName || 'Empleado';
    if (rawName.includes('---') || rawName.includes('___')) return '';

    if (employee?.isVacante) {
        return `
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:800; color:#ef4444; font-size:0.82rem; line-height:1.3;">⚠️ VACANTE</span>
        </div>`;
    }

    const name = escapeHtml(window.formatDisplayName(rawName));
    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' \u{1F3D6}\u{FE0F}' : '';
    
    if (employee?.isAbsentInformative) {
        return `
        <div style="display:flex; flex-direction:column; gap:2px; opacity:0.6;">
            <span style="font-weight:700; color:#64748b; font-size:0.82rem; line-height:1.3;">${name}${vacIcon}</span>
        </div>`;
    }

    const isExplicitRefuerzo = Boolean(employee?.isRefuerzo === true || employee?.origen === 'refuerzo' || employee?.payload?.tipo_modulo === 'refuerzo');
    const supportBadge = isExplicitRefuerzo ? `<span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;margin-left:6px;">REFUERZO</span>` : '';

    return `
    <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#0f172a; font-size:0.82rem; line-height:1.3;">${name}${vacIcon}${supportBadge}</span>
    </div>`;
};

window.renderEmpleadoCell = (turnoEmpleado, { isCompact = false } = {}) => {
    if (!turnoEmpleado) return '<div class="preview-cell-empty"></div>';

    const turnoVisible = turnoEmpleado.incidencia || turnoEmpleado.turno || '';
    const hayCambio = Boolean(turnoEmpleado.cambio);

    // Capsule definitions (Shifts & Incidences)
    const capsuleStyles = {
        V:    { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc', label: 'Vacaciones', icon: '\u{1F3D6}\u{FE0F}' },
        B:    { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', label: 'Baja', icon: '' },
        P:    { bg: '#ffedd5', color: '#9a3412', border: '#fdba74', label: 'Permiso', icon: '' },
        M:    { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Mañana', icon: '' },
        T:    { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: 'Tarde', icon: '' },
        N:    { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: 'Noche', icon: '\u{1F319}' },
        D:    { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: 'Descanso', icon: '' }
    };

    const sKey = window.TurnosRules?.shiftKey?.(turnoVisible, 'NORMAL') || String(turnoVisible);
    const styleKey = sKey.toUpperCase();
    const style = capsuleStyles[styleKey] || { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: turnoVisible || '-', icon: '' };

    if (isCompact) {
        // VISTA MENSUAL
        const labelText = style.label || turnoVisible || '-';
        const compactIcons = (style.icon ? ` ${style.icon}` : '') + (hayCambio ? ' 🔄' : '');
        
        return `
        <div style="display:flex; align-items:center; justify-content:center; padding:4px 2px; border-radius:6px; font-size:0.7rem; font-weight:700; min-height:45px; background:${style.bg}; color:${style.color}; border:1px solid rgba(0,0,0,0.05);">
            ${escapeHtml(labelText)}${compactIcons ? ` <span style="font-size:0.65rem;">${compactIcons}</span>` : ''}
        </div>`;
    } else {
        // VISTA SEMANAL
        let label = style.label || turnoVisible || '-';
        
        // CORRECCIÓN V12.5.16: Bloqueo de CT en render
        if (window.isInvalidLegacyChangeValue && window.isInvalidLegacyChangeValue(label)) {
            label = turnoEmpleado.turnoBase || '-';
            console.warn('[RENDER_GUARD_DEBUG] Bloqueado CT en render cell', { labelOriginal: style.label || turnoVisible });
        }

        const iconsToRender = new Set();
        if (style.icon) iconsToRender.add(style.icon);
        if (turnoEmpleado.icon) iconsToRender.add(turnoEmpleado.icon);
        if (Array.isArray(turnoEmpleado.icons)) {
            turnoEmpleado.icons.forEach(i => { if (i) iconsToRender.add(i); });
        }
        
        if (hayCambio) iconsToRender.add('\u{1F504}');

        let iconHtml = '';
        iconsToRender.forEach(icon => {
            const isSync = icon === '\u{1F504}';
            iconHtml += ` <span style="margin-left:4px;${isSync ? 'color:initial !important;' : ''}">${icon}</span>`;
        });

        return `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:75px; gap:4px;">
            <span class="v-pill" style="display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; border-radius:999px; font-size:0.8rem; font-weight:800; background:${style.bg} !important; color:${style.color} !important; border:1px solid ${style.border} !important; box-shadow:0 1px 3px rgba(0,0,0,0.06); white-space:nowrap;">
                ${escapeHtml(label)}${iconHtml}
            </span>
        </div>`;
    }
};;

window.DateManager = {
    state: {
        currentDate: window.isoDate(new Date()),
        view: 'weekly'
    },

    init: function() {
        this.state.currentDate = window._previewDate || window.isoDate(new Date());
        this.state.view = window._previewMode || 'weekly';
        this.initPicker();
        this.updateUI();
    },

    updateUI: function() {
        const btnW = document.getElementById('btnViewWeekly');
        const btnM = document.getElementById('btnViewMonthly');
        if (btnW) btnW.classList.toggle('active', this.state.view === 'weekly');
        if (btnM) btnM.classList.toggle('active', this.state.view === 'monthly');
        
        window._previewMode = this.state.view;
        window._previewDate = this.state.currentDate;
    },

    prev: function() {
        const d = new Date(this.state.currentDate + 'T12:00:00');
        if (this.state.view === 'weekly') {
            d.setDate(d.getDate() - 7);
        } else {
            d.setMonth(d.getMonth() - 1, 1); // Ir al día 1 del mes anterior
        }
        this.state.currentDate = window.isoDate(d);
        this.syncAndRender();
    },

    next: function() {
        const d = new Date(this.state.currentDate + 'T12:00:00');
        if (this.state.view === 'weekly') {
            d.setDate(d.getDate() + 7);
        } else {
            d.setMonth(d.getMonth() + 1, 1); // Ir al día 1 del mes siguiente
        }
        this.state.currentDate = window.isoDate(d);
        this.syncAndRender();
    },

    today: function() {
        this.state.currentDate = window.isoDate(new Date());
        this.syncAndRender();
    },

    switchView: function(mode) {
        this.state.view = mode;
        this.updateUI();
        this.initPicker();
        window.renderPreview();
    },

    syncAndRender: function() {
        this.updateUI();
        if (window._fpInstance) window._fpInstance.setDate(this.state.currentDate, false);
        window.renderPreview();
    },

    initPicker: function() {
        const input = document.getElementById('datePicker');
        if (!input) return;
        if (window._fpInstance) window._fpInstance.destroy();
        const trigger = document.getElementById('datePickerTrigger');
        input.style.position = 'absolute';
        input.style.visibility = 'visible';
        input.style.opacity = '0';
        input.style.width = '1px';
        input.style.height = '1px';
        input.style.pointerEvents = 'none';

        const config = {
            locale: 'es',
            dateFormat: 'Y-m-d',
            defaultDate: this.state.currentDate,
            positionElement: trigger || input,
            onChange: (selectedDates) => {
                if (selectedDates.length) {
                    this.state.currentDate = window.isoDate(selectedDates[0]);
                    this.syncAndRender();
                }
            }
        };

        if (this.state.view === 'monthly') {
            config.plugins = [new monthSelectPlugin({ shorthand: true, dateFormat: "Y-m", altFormat: "F Y" })];
        }

        window._fpInstance = flatpickr(input, config);
    },

    openPicker: function() {
        this.initPicker();
        if (window._fpInstance) window._fpInstance.setDate(this.state.currentDate, false);
        if (window._fpInstance) window._fpInstance.open();
    }
};

window.renderPreview = async () => {
    const display = document.getElementById('dateDisplay');
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const area = $('#previewContent');
    if (!area) return;

    // Asegurar carga del mapa de orden V9
    await window.loadV9ExcelOrderMap();
    
    const hotelSel = $('#prevHotel')?.value || 'all';
    const isWeekly = window._previewMode === 'weekly';
        const rawDate = window._previewDate || window.isoDate(new Date());
        const rawMonth = window._previewDate.substring(0,7);

    area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando cuadrantes...</div>`;

    try {
        window._previewPuestosModels = Object.create(null);
        // TAREA CODEX: Cachear el resultado final para publicación exacta
        window._lastRenderedPreviewSnapshotSource = {
            semana_inicio: '',
            semana_fin: '',
            hoteles: []
        };
        let start, end;
        if (isWeekly) {
            const base = new Date(rawDate + 'T12:00:00');
            start = window.getMonday(base);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            
            if (display) {
                const fmt = (d) => {
                    const dd = d.getDate().toString().padStart(2, '0');
                    const mm = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][d.getMonth()];
                    return `${dd} de ${mm}`;
                };
                display.textContent = `${fmt(start)} — ${fmt(end)} ${end.getFullYear()}`;
            }
        } else {
            const [y, m] = rawMonth.split('-').map(Number);
            start = new Date(y, m - 1, 1);
            if (display) display.textContent = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;

            end = new Date(y, m, 0);
        }

        const startISO = window.isoDate(start);
        const endISO = window.isoDate(end);
        
        window._lastRenderedPreviewSnapshotSource.semana_inicio = startISO;
        window._lastRenderedPreviewSnapshotSource.semana_fin = endISO;

        // Cargar eventos con rango extendido ±90 días para capturar periodos largos
        // (ej. VAC Cristina 20/04�03/05 debe estar visible al ver semana 20/04 O 27/04)
        const extStart = new Date(start); extStart.setDate(extStart.getDate() - 90);
        const extEnd   = new Date(end);   extEnd.setDate(extEnd.getDate() + 90);
        const extStartISO = window.isoDate(extStart);
        const extEndISO   = window.isoDate(extEnd);

        let { rows: data } = await window.TurnosDB.fetchRangoCalculado(startISO, endISO);
        // Fetch de eventos con ventana ampliada para no perder periodos VAC/BAJA largos
        const eventosAmpliados = await window.TurnosDB.fetchEventos(extStartISO, extEndISO);
        const eventos = eventosAmpliados;

        // Guardar como global para que ficha, dashboard y módulos secundarios lo usen
        window.eventosGlobales = eventosAmpliados;
        window.eventosActivos  = eventosAmpliados; // compatibilidad con código anterior

        if (window.DEBUG_MODE === true) {
            console.log('[GLOBAL EVENTOS]', window.eventosGlobales?.length);
            console.log('[ACTIVOS EVENTOS]', window.eventosActivos?.length);
            console.log('[EVENTOS CRISTINA]', (window.eventosGlobales || []).filter(e =>
                JSON.stringify(e).toLowerCase().includes('cristina')
            ));
            console.log('[EVENTOS VAC]', (window.eventosGlobales || []).filter(e =>
                String(e.tipo || '').toUpperCase().includes('vac')
            ));
        }

        const hotels = await window.TurnosDB.getHotels();
        const profiles = await window.TurnosDB.getEmpleados();
        const excelSource = await window.loadAdminExcelSourceRows();
        
        // [CAMBIOS_PANEL_DEBUG load]
        const approvedChanges = (eventos || []).filter(ev => {
            const t = window.normalizeTipo ? window.normalizeTipo(ev.tipo) : String(ev.tipo || '').toUpperCase();
            const s = (ev.estado || 'activo').toLowerCase();
            return (t === 'CAMBIO_TURNO' || t === 'INTERCAMBIO_TURNO') && (s === 'activo' || s === 'aprobado');
        });
        
        if (startISO === '2026-04-13') {
            console.log('[CAMBIOS_PANEL_DEBUG load]', {
                semana: "2026-04-13",
                hotel: hotelSel,
                totalCambiosAprobados: approvedChanges.length,
                cambios: approvedChanges
            });
        }
        
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

            // --- TAREA CODEX: GENERAR SOURCE ROWS SINTÉTICOS SI NO HAY EXCEL ---
            // Si no hay filas de Excel para esta semana/hotel, pero hay datos en Supabase,
            // creamos filas virtuales para que el motor pueda renderizar.
            if (hotelSourceRows.length === 0 && data && data.length > 0) {
                const hotelData = data.filter(r => r.hotel_id === hName);
                if (hotelData.length > 0) {
                    const empsInHotel = [...new Set(hotelData.map(r => r.empleado_id))];
                    empsInHotel.forEach((empId, idx) => {
                        const empProfile = (profiles || []).find(p => p.id === empId || p.nombre === empId);
                        const row = {
                            empleadoId: empId,
                            displayName: empProfile?.nombre || empId,
                            rowIndex: empProfile?.orden ?? empProfile?.display_order ?? empProfile?.sort_order ?? 999,
                            weekStart: startISO,
                            values: columns.map(c => {
                                const found = hotelData.find(r => r.empleado_id === empId && r.fecha === c.date);
                                return found ? found.turno : null;
                            })
                        };
                        hotelSourceRows.push(row);
                    });
                }
            }

            const previewModel = window.createPuestosPreviewModel({
                hotel: hName,
                dates: columns.map(c => c.date),
                sourceRows: hotelSourceRows,
                rows: data,
                eventos,
                employees: profiles
            });

            window.empleadosGlobales = profiles;

            previewModel.puestos.forEach(puesto => {
                window._previewPuestosModels[puesto.puesto_id] = previewModel;
            });
            window.detectarErrores(previewModel);
            window.validarPreviewModel(previewModel);

            if (previewModel.puestos.length === 0) continue;
            const viewType = isWeekly ? 'weekly' : 'monthly';
            const employeesToRender = previewModel.getEmployees(viewType);
            
            // DEDUPLICACIÓN DE SEGURIDAD (Si Admin no lo muestra duplicado, nosotros tampoco)
            const seenEmps = new Set();
            const deduplicatedList = [];
            employeesToRender.forEach(emp => {
                const key = emp.employee_id;
                if (!seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });

            if (!deduplicatedList.length) continue;

            // TAREA CODEX: Cachear el resultado final para publicación exacta
            const hotelSnapshot = {
                hotel: hName,
                empleados: deduplicatedList.map((employee, idx) => {
                    const daysMap = {};
                    columns.forEach(c => {
                        const resolved = previewModel.getTurnoEmpleado(employee.employee_id, c.date);
                        const visual = window.TurnosRules ? window.TurnosRules.describeCell(resolved) : { label: resolved.turno, icons: resolved.icons || [] };
                        
                        // B4 FIX: Garantizar códigos canónicos para ausencias en el cache
                        const absCode = resolved.incidencia
                            ? (resolved.incidencia === 'PERMISO' ? 'PERM'
                               : resolved.incidencia === 'FORMACION' ? 'FORM'
                               : resolved.incidencia === 'BAJA' ? 'BAJA'
                               : resolved.incidencia === 'VAC' ? 'VAC'
                               : resolved.incidencia)
                            : null;

                        const icons = [...new Set([
                            ...(visual.icon ? [visual.icon] : (resolved.icon ? [resolved.icon] : [])),
                            ...((resolved.cambio || resolved.intercambio) ? ['\u{1F504}'] : [])
                        ])];

                        daysMap[c.date] = {
                            label: visual.label || absCode || resolved.turno || '',
                            code: absCode || resolved.turno || '',
                            icons: icons,
                            estado: (resolved.isAbsent || resolved.incidencia) ? 'ausente' : 'operativo',
                            origen: resolved.incidencia || resolved.origen || 'base',
                            titular_cubierto: resolved.titular || null,
                            sustituto: resolved.sustituidoPor || null,
                            changed: !!resolved.cambio
                        };
                    });
                    return {
                        nombre: employee.nombre || employee.employee_id,
                        nombreVisible: employee.nombreVisible || employee.displayName || employee.nombre || employee.employee_id,
                        empleado_id: employee.employee_id,
                        // ORDEN: usar puestoOrden del modelo (Excel map), nunca idx secuencial
                        orden: employee.puestoOrden || (idx + 1),
                        dias: daysMap
                    };
                })
            };
            window._lastRenderedPreviewSnapshotSource.hoteles.push(hotelSnapshot);

            const renderEmployeeTable = true;

            if (renderEmployeeTable) {
                const isWeekly = (new Date(endISO) - new Date(startISO)) < (8 * 24 * 60 * 60 * 1000);
                const tableClass = isWeekly ? 'preview-table-premium' : 'preview-table-compact';
                const thWidth = isWeekly ? '220px' : '180px';
                const thPadding = isWeekly ? '15px 25px' : '10px 15px';
                const cellPadding = isWeekly ? '8px' : '4px';
                const minColWidth = isWeekly ? '145px' : '85px';

                const hotelSection = document.createElement('div');
                hotelSection.innerHTML = `
                <div class="glass-panel" style="margin-bottom:3rem; padding:0; overflow:hidden; border:1px solid #e2e8f0; background:white; border-radius:16px;">
                    <div style="padding:18px 25px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:15px; background:#f8fafc;">
                        <img src="${hName.toLowerCase().includes('guadiana') ? 'guadiana logo.jpg' : 'cumbria logo.jpg'}" style="width:38px; height:38px; object-fit:contain;">
                        <h2 style="margin:0; font-size:1.1rem; color:#1e293b; font-weight:800;">${hName} <span style="color:#94a3b8; font-size:0.85rem;">${isWeekly ? `Semana ${window.fmtDateLegacy(startISO)}` : `${window.fmtDateLegacy(startISO)} - ${window.fmtDateLegacy(endISO)}`}</span></h2>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="${tableClass}" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:${thPadding}; text-align:left; border-bottom:1px solid #f1f5f9; width:${thWidth}; color:#64748b; font-size:0.7rem; text-transform:uppercase; position:sticky; left:0; background:#f8fafc; z-index:10; border-right:1px solid #f1f5f9;">Empleado</th>
                                    ${columns.map(c => {
                                        const isWeekend = c.dayName === 'SAB' || c.dayName === 'DOM';
                                        const bg = (!isWeekly && isWeekend) ? '#f1f5f9' : '#f8fafc';
                                        return `<th style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:${minColWidth}; border-left:1px solid #f1f5f9; background:${bg};"><div style="font-size:0.65rem; color:#94a3b8;">${c.dayName}</div><div style="font-size:0.75rem; font-weight:600;">${c.dayDisplay.toLowerCase()}</div></th>`;
                                    }).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${deduplicatedList.map(employee => `
                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:${isWeekly ? '12px 25px' : '8px 15px'}; background:white; position:sticky; left:0; z-index:5; border-right:1px solid #f1f5f9;">
                                            ${window.renderEmpleadoRowHeader(employee, { showVacationIcon: true, isCompact: !isWeekly })}
                                        </td>
                                        ${columns.map(c => {
                                            const isWeekend = c.dayName === 'SAB' || c.dayName === 'DOM';
                                            const bg = (!isWeekly && isWeekend) ? 'rgba(0,0,0,0.02)' : 'transparent';
                                            return `<td style="padding:${cellPadding}; text-align:center; border-left:1px solid #f1f5f9; background:${bg};">${window.renderEmpleadoCell(previewModel.getTurnoEmpleado(employee.employee_id, c.date), { isCompact: !isWeekly })}</td>`;
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
                        const names = list.map(item => `<span title="${escapeHtml(item.title || '')}">${escapeHtml(item.name)}${item.icon === '�x' ? '�x' : ''}</span>`).join(' · ');
                        return `<div class="cal2-group cal2-${cls}"><span class="cal2-icon">${defaultIcon}</span><span class="cal2-names">${names}</span></div>`;
                    };

                    cells.push(`<div class="cal2-cell">
                        <div class="cal2-daynum">${new Date(dateKey + 'T12:00:00').getDate()}</div>
                        <div class="cal2-content">
                            ${badge(groups.M,'m','�ܬ️')}
                            ${badge(groups.T,'t','�xR�️')}
                            ${badge(groups.N,'n','�xR"')}
                            ${badge(groups.D,'d','�xܴ')}
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
                    <div class="cal2-header"><div>LUN</div><div>MAR</div><div>MI�0</div><div>JUE</div><div>VIE</div><div>SÁB</div><div>DOM</div></div>
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
    if (!window.TurnosDB) {
        console.error('[ADMIN ERROR] El motor de datos (TurnosDB) no ha cargado correctamente. Revisa la consola para errores de sintaxis en supabase-dao.js.');
        return;
    }
    window._fpWeek = flatpickr("#prevWeekDate", { dateFormat: "Y-m-d", defaultDate: "today", locale: "es", onChange: () => window.renderPreview() });
    window._fpMonth = flatpickr("#prevMonth", { dateFormat: "Y-m", defaultDate: new Date(), locale: "es", plugins: [new monthSelectPlugin({ shorthand: true, dateFormat: "Y-m" })], onChange: () => window.renderPreview() });
    const hotels = await window.TurnosDB.getHotels();
    const sel = $('#prevHotel');
    if (sel) sel.innerHTML = `<option value="all">TODOS LOS HOTELES</option>` + hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    const excelSel = $('#excelHotel');
    if (excelSel) excelSel.innerHTML = `<option value="all">Filtro por Hotel: Ver Todos</option>` + hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    const excelMonth = $('#excelMonth');
    if (excelMonth && !excelMonth.value) excelMonth.value = (window.isoDate(new Date()) || '').slice(0, 7);
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

// ==========================================
// DIAGN�STICO VAC � llamar desde consola o con DEBUG_MODE=true
// ==========================================
window.debugVacCristina = (fechaTest = '2026-04-20') => {
    const eventos = window.eventosActivos || [];

    const todosCristina = eventos.filter(e =>
        JSON.stringify(e).toLowerCase().includes('cristina')
    );
    const todosVAC = eventos.filter(e =>
        String(e.tipo || '').toUpperCase().includes('VAC')
    );
    const todosCumbria = eventos.filter(e =>
        JSON.stringify(e).toLowerCase().includes('cumbria')
    );

    console.group('[VAC DEBUG DIAGN�STICO]');
    console.log('[VAC DEBUG TODOS EVENTOS] Total:', eventos.length);
    console.log('[VAC DEBUG CRISTINA]', todosCristina);
    console.log('[VAC DEBUG TIPO VAC]', todosVAC);
    console.log('[VAC DEBUG CUMBRIA]', todosCumbria);
    console.groupEnd();

    // Test directo del motor para Cristina
    if (window.resolveEmployeeDay) {
        const profile = (window.empleadosGlobales || []).find(e =>
            window.normalizeId(e.id || '').includes('cristina') ||
            window.normalizeId(e.nombre || '').includes('cristina')
        ) || { id: 'Cristina', nombre: 'Cristina', hotel_id: 'Cumbria Spa&Hotel' };

        const testResult = window.resolveEmployeeDay({
            empleado: profile,
            empleadoId: profile.id || 'Cristina',
            hotel: profile.hotel_id || 'Cumbria Spa&Hotel',
            fecha: fechaTest,
            turnoBase: 'D',
            eventos,
            baseIndex: window._lastBaseIndex || null,
            allEvents: eventos,
            resolveId: resolveId
        });
        console.log(`[TEST CRISTINA VAC ${fechaTest}]`, testResult);
        console.log('[INTERPRETACI�N]',
            testResult.incidencia === 'VAC' || testResult.turno === 'VAC'
                ? '�S& Motor resuelve VAC correctamente'
                : todosCristina.length === 0
                    ? '�R PROBLEMA DE DATOS: no hay eventos de Cristina en eventosActivos �  fallo en fetch/query'
                    : todosVAC.filter(e => JSON.stringify(e).toLowerCase().includes('cristina')).length === 0
                        ? '�R PROBLEMA DE MATCHING: hay eventos de Cristina pero ninguno de tipo VAC �  posible discrepancia campo tipo'
                        : '�a�️ PROBLEMA DE MOTOR/RENDER: el evento VAC existe y matchea pero resolveEmployeeDay no lo aplica'
        );
        return testResult;
    } else {
        console.warn('[debugVacCristina] resolveEmployeeDay no disponible');
        return null;
    }
};

function fmtDateLegacy(date) {
    if (!date) return '-';
    // Forzar mediodía para evitar desfases por zona horaria al parsear YYYY-MM-DD
    const d = new Date(String(date).includes('T') ? date : date + 'T12:00:00');
    if (isNaN(d.getTime())) return date;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}
window.fmtDateLegacy = fmtDateLegacy;

// ==========================================
// 6. GESTI�N DE EMPLEADOS Y PERSONAL (RESTORED)
// ==========================================
window.populateEmployees = async () => {
    const area = $('#employeesContent'); if (!area) return;
    area.innerHTML = '<div style="padding:4rem; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando empleados...</div>';
    
    try {
        // Rango de 30 días pasados y 7 días futuros para estadísticas y estado
        const today = new Date();
        const end = new Date();
        end.setDate(today.getDate() + 7);
        const start = new Date();
        start.setDate(today.getDate() - 30);
        const startISO = window.isoDate(start) || start.toISOString().split('T')[0];
        const endISO = window.isoDate(end) || end.toISOString().split('T')[0];
        const todayISO = window.isoDate(today) || today.toISOString().split('T')[0];

        const { rows, eventos } = await window.TurnosDB.fetchRangoCalculado(startISO, endISO);
        // Usar eventosGlobales si Vista Previa ya los cargó con rango ampliado;
        // si no, usar los propios (rango hoy-30 a hoy+7)
        if (!window.eventosGlobales || window.eventosGlobales.length === 0) {
            window.eventosGlobales = eventos;
            window.eventosActivos = eventos;
        } else {
            window.eventosActivos = window.eventosGlobales;
        }
        
        const profilesResult = await window.TurnosDB.getEmpleados();
        window.empleadosGlobales = profilesResult;
        
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
                    
                    let label = cell.turno || '�';
                    if (cell.tipo && cell.tipo !== 'NORMAL' && cell.tipo !== 'CT') label = cell.tipo;
                    
                    const cls = window.TurnosRules ? window.TurnosRules.shiftKey(label, cell.tipo) : '';
                    if (date <= todayISO) {
                        if (['m', 't', 'n', 'v', 'd', 'b'].includes(cls)) s[cls]++;
                        else s.x++;
                    }

                    s.history.push({
                        fecha: date,
                        turno: label,
                        cls: cls,
                        original: cell.turno || '',
                        cell: cell
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
                
                const futureShifts = s.history.filter(h => h.fecha >= todayISO).sort((a,b) => a.fecha.localeCompare(b.fecha));
                const currentState = futureShifts[0] || { cls: 'x', turno: '�', cell: {} };
                const nextWorkingShift = futureShifts.find(h => ['m', 't', 'n'].includes(h.cls)) || null;

                let stateText = 'Activo';
                if (currentState.cls === 'v') stateText = 'Vacaciones';
                else if (currentState.cls === 'b') stateText = 'Baja';

                let substituteText = '';
                if (currentState.cell?.cambio || currentState.cell?.real !== currentState.cell?.titular) {
                    const rId = currentState.cell?.real_id || currentState.cell?.real;
                    if (rId && (rId === p.id || rId === empName)) substituteText = `<span style="color:#f59e0b; font-size:0.85em; font-weight:600; margin-left:4px;">(Sustituto)</span>`;
                    else if (rId) substituteText = `<span style="color:#3b82f6; font-size:0.85em; font-weight:600; margin-left:4px;">(Ausente)</span>`;
                }

                const nextDate = nextWorkingShift ? new Date(nextWorkingShift.fecha).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit'}) : '';

                return `
                <div class="emp-card-premium" onclick="window.openEmpDrawer('${empName.replace(/'/g, "\\'")}')">
                    <div class="ep-gradient" style="background: linear-gradient(135deg, hsl(${hue}, 70%, 65%), hsl(${hue}, 70%, 45%))"></div>
                    <div class="ep-body">
                        <div class="ep-avatar-wrap">
                            <div class="ep-avatar" style="background: hsl(${hue}, 70%, 95%); color: hsl(${hue}, 70%, 30%)">${initials}</div>
                        </div>
                        <div class="ep-info">
                            <h3 class="ep-name">${empName} <span style="opacity:0.5; font-size:0.75em; font-weight:normal;">&middot; #${p.id || 'N/A'}</span></h3>
                            <p class="ep-role">${p.puesto || 'Personal'} <span style="margin-left:5px; font-weight:700; opacity:0.9; font-size:0.9em;" class="color-${currentState.cls}">${stateText}</span>${substituteText}</p>
                        </div>
                        <div class="ep-stats">
                            <div class="ep-stat"><span class="ep-label">Hoy</span><span class="ep-val color-${currentState.cls}" style="font-size:0.9rem;">${currentState.turno}</span></div>
                            <div class="ep-stat"><span class="ep-label">Próximo</span><span class="ep-val ${nextWorkingShift ? 'color-' + nextWorkingShift.cls : ''}" style="font-size:0.9rem;">${nextWorkingShift ? nextWorkingShift.turno + ' (' + nextDate + ')' : '�'}</span></div>
                        </div>
                        <div class="ep-footer">
                             ${totalWork > 0 ? `<div class="ep-progress-label">Actividad 30 días</div>` : ''}
                             ${totalWork > 0 ? `<div class="ep-progress-bar"><div class="ep-progress-fill" style="width:${Math.min(100, (totalWork/30)*100)}%; background:hsl(${hue}, 70%, 50%)"></div></div>` : ''}
                             ${totalWork > 0 ? `<div class="ep-total">${totalWork} turnos totales</div>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');
            return `<div class="emp-hotel-section">
                <div class="section-title-premium">
                    <span class="stp-icon">�x��</span>
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

window.closeEmpDrawer = () => { if($('#empDrawer')) $('#empDrawer').classList.remove('open'); };

// ==========================================
// 6B. EMPLEADOS - LISTADO OPERATIVO EN LINEAS
// ==========================================
window._employeeLineFilters = window._employeeLineFilters || {
    hotel: 'all',
    estado: 'operativo',
    search: '',
    sort: 'operativo'
};

window.employeeNorm = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

window.employeeShortHotel = (hotel) => {
    const h = String(hotel || '').trim();
    if (!h) return 'Sin hotel';
    if (/cumbria/i.test(h)) return 'Cumbria';
    if (/guadiana|sercotel/i.test(h)) return 'Guadiana';
    return h;
};

window.employeeDash = (value) => {
    if (value === 0) return '0';
    if (value === false || value === null || typeof value === 'undefined' || value === '') return '&mdash;';
    return escapeHtml(value);
};

window.employeeShiftBadge = (shift, extra = '') => {
    const raw = String(shift || '').trim();
    const code = window.normalizePreviewTurno ? window.normalizePreviewTurno(raw) : raw.toUpperCase();
    const cls = code === 'M' ? 'm' : code === 'T' ? 't' : code === 'N' ? 'n' : code === 'D' ? 'd' : raw.toUpperCase().startsWith('VAC') ? 'v' : raw.toUpperCase().startsWith('BAJA') ? 'b' : 'x';
    return `<span class="emp-line-shift emp-line-shift-${cls}">${raw ? escapeHtml(raw) : '&mdash;'}${extra ? ` <small>${escapeHtml(extra)}</small>` : ''}</span>`;
};

window.employeeStatusMeta = (estado) => {
    const key = window.employeeNorm(estado);
    if (key.includes('vac')) return { label: 'Vacaciones', cls: 'vacaciones', rank: 4 };
    if (key.includes('baja') || key.includes('perm')) return { label: 'Baja', cls: 'baja', rank: 5 };
    return { label: 'Activo', cls: 'activo', rank: 1 };
};

window.employeeOperationalRoleMeta = (rol) => {
    const key = window.employeeNorm(rol);
    if (key.includes('refuerzo')) return { label: 'Refuerzo', cls: 'ocasional', rank: 3 };
    if (key.includes('sust')) return { label: 'Sustituto', cls: 'sustituto', rank: 2 };
    return { label: 'Titular', cls: 'activo', rank: 1 };
};

window.employeeConfiguredRole = (profile) => {
    const key = window.employeeNorm(profile?.rol_operativo || profile?.rol || profile?.role || '');
    if (key.includes('refuerzo')) return 'refuerzo';
    if (key.includes('sust')) return 'sustituto';
    return 'titular';
};

window.buildEmployeeLineModel = (empleado) => {
    const profile = empleado?.profile || {};
    const stats = empleado?.stats || {};
    const assignedHotels = Array.isArray(profile.hoteles_asignados) ? profile.hoteles_asignados.filter(Boolean) : (typeof profile.hoteles_asignados === 'string' ? profile.hoteles_asignados.split(/[,;|]/).map(h => h.trim()).filter(Boolean) : []);
    const assignedHotelLabel = assignedHotels.length > 1 ? 'Ambos hoteles' : (assignedHotels[0] || stats.hotel || profile.hotel_id || profile.hotel || 'Sin hotel');
    const todayISO = empleado?.todayISO || window.isoDate(new Date());
    const events = Array.isArray(empleado?.eventos) ? empleado.eventos : [];
    const history = Array.isArray(stats.history) ? [...stats.history].sort((a, b) => a.fecha.localeCompare(b.fecha)) : [];
    const todayShift = history.find(h => h.fecha === todayISO) || null;
    const nextShift = history.find(h => h.fecha > todayISO && ['m', 't', 'n', 'd'].includes(h.cls)) || null;
    const id = profile.id || stats.id || stats.emp || '';
    const nombre = profile.nombre || stats.emp || id || 'Empleado';
    const tipoEstructural = window.getEmployeeStructuralType ? window.getEmployeeStructuralType(profile) : (profile.tipo_personal || profile.contrato || profile.tipo || 'fijo');
    const activeEvents = events.filter(ev => {
        const start = String(ev.fecha_inicio || '').slice(0, 10);
        const end = String(ev.fecha_fin || start || '').slice(0, 10);
        return (ev.estado || 'activo') !== 'anulado' && start && start <= todayISO && todayISO <= end;
    });
    const activeAbsences = activeEvents.filter(ev => /VAC|BAJA|PERM/i.test(String(ev.tipo || '')));
    const activeChanges = activeEvents.filter(ev => /CAMBIO|INTERCAMBIO|REFUERZO/i.test(String(ev.tipo || '')));
    const hasExplicitRefuerzo = activeEvents.some(ev => Boolean(ev.isRefuerzo === true || ev.origen === 'refuerzo' || ev.payload?.tipo_modulo === 'refuerzo' || ev.meta?.refuerzo === true || /REFUERZO/i.test(String(ev.tipo || ''))));
    const isSubstitute = Boolean(todayShift?.cell?.real && todayShift?.cell?.titular && todayShift.cell.real !== todayShift.cell.titular)
        || activeEvents.some(ev => /SUSTITUCION|COBERTURA/i.test(String(ev.tipo || '')));
    const configuredRole = window.employeeConfiguredRole ? window.employeeConfiguredRole(profile) : 'titular';
    const rolOperativo = hasExplicitRefuerzo ? 'refuerzo' : (isSubstitute ? 'sustituto' : configuredRole);

    let estado = profile.activo === false || window.employeeNorm(profile.estado_empresa).includes('baja') ? 'Baja' : 'Activo';
    if (todayShift?.cls === 'v' || activeAbsences.some(ev => /VAC/i.test(ev.tipo || ''))) estado = 'Vacaciones';
    else if (todayShift?.cls === 'b' || activeAbsences.some(ev => /BAJA|PERM/i.test(ev.tipo || ''))) estado = 'Baja';

    const bajas = (stats.b || 0) + (stats.p || 0);
    const ajusteVac = Number(profile.ajuste_vacaciones_dias || 0);

    return {
        id,
        nombre,
        hotel: assignedHotelLabel,
        puesto: profile.puesto || profile.categoria || 'Personal',
        tipo: tipoEstructural,
        tipoEmpleado: tipoEstructural,
        rolOperativo,
        estado,
        id_interno: profile.id_interno,
        turnoHoy: todayShift ? { turno: todayShift.turno, cls: todayShift.cls, cambio: Boolean(todayShift?.cell?.cambio) } : null,
        proximoTurno: nextShift ? { turno: nextShift.turno, cls: nextShift.cls, fecha: nextShift.fecha } : null,
        resumen30d: {
            mananas: stats.m || null,
            tardes: stats.t || null,
            noches: stats.n || null,
            descansos: stats.d || null,
            vacaciones: stats.v || null,
            bajas: bajas || null
        },
        vacacionesUsadas: stats.v || null,
        bajas: bajas || null,
        cambiosActivos: activeChanges.length || (todayShift?.cell?.cambio ? 1 : null),
        saldoVacaciones: Number.isFinite(ajusteVac) && ajusteVac !== 0 ? ajusteVac : null,
        saldoDescansos: null,
        profile,
        history,
        events,
        activeEvents,
        hasExplicitRefuerzo,
        isSubstitute
    };
};

window.renderEmployeeLine = (line) => {
    const status = window.employeeStatusMeta(line.estado);
    const typeMeta = window.employeeProfileTypeMeta ? window.employeeProfileTypeMeta(line.tipoEmpleado || line.tipo) : { label: line.tipoEmpleado || line.tipo || 'Fijo', cls: 'fijo' };
    const roleMeta = window.employeeOperationalRoleMeta ? window.employeeOperationalRoleMeta(line.rolOperativo) : { label: line.rolOperativo || 'Titular', cls: 'activo' };
    const nextDate = line.proximoTurno?.fecha ? new Date(`${line.proximoTurno.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '';
    const id = escapeHtml(line.id || 'N/A');
    return `
        <div class="emp-line-row advanced" onclick="window.openEmpDrawer('${id}')">
            <span class="el-id" style="display:flex; flex-direction:column; gap:2px;">
                <strong style="color: var(--accent); font-size:0.85rem;">${escapeHtml(line.id_interno || '-')}</strong>
                <small style="opacity:0.5; font-size:0.6rem;">#${id}</small>
            </span>
            <span class="el-name-block"><strong>${escapeHtml(line.nombre)}</strong><small>${escapeHtml(line.puesto)}</small></span>
            <span class="el-hotel">${escapeHtml(window.employeeShortHotel(line.hotel))}</span>
            <span class="el-text">${escapeHtml(line.puesto)}</span>
            <span class="el-pill type el-type-${escapeHtml(typeMeta.cls || 'fijo')}" title="Tipo de empleado">${escapeHtml(typeMeta.label)}</span>
            <span class="el-pill role el-role-${escapeHtml(roleMeta.cls || 'activo')}" title="Rol operativo">${escapeHtml(roleMeta.label)}</span>
            <span class="emp-line-status emp-line-status-${status.cls}">${escapeHtml(status.label)}</span>
            <span>${line.turnoHoy ? window.employeeShiftBadge(line.turnoHoy.turno, line.turnoHoy.cambio ? '' : '') : window.employeeShiftBadge('')}</span>
            <span>${line.proximoTurno ? window.employeeShiftBadge(line.proximoTurno.turno, nextDate) : window.employeeShiftBadge('')}</span>
            <span class="emp-line-actions" onclick="event.stopPropagation()">
                <button type="button" onclick="window.openEmpDrawer('${id}')">Ficha</button>
                <button type="button" onclick="window.switchSection('preview')">Turnos</button>
            </span>
        </div>
    `;
};
window.renderEmployeeLineRows = () => {
    const area = $('#employeesContent');
    if (!area || !window._employeeLineModels) return;
    const filters = window._employeeLineFilters;
    const restoreSearchFocus = document.activeElement?.id === 'empLineSearch';
    const q = window.employeeNorm(filters.search);
    let lines = [...window._employeeLineModels].filter(line => {
        if (filters.hotel !== 'all' && line.hotel !== filters.hotel) return false;
        if (filters.estado !== 'all') {
            if (filters.estado === 'operativo' && line.estado === 'Baja') return false;
            if (filters.estado === 'apoyo' && line.tipoEmpleado !== 'apoyo') return false;
            if (filters.estado === 'ocasional' && line.tipoEmpleado !== 'ocasional') return false;
            if (filters.estado === 'sustituto' && line.rolOperativo !== 'sustituto') return false;
            if (filters.estado === 'refuerzo' && line.rolOperativo !== 'refuerzo') return false;
            if (!['operativo', 'apoyo', 'ocasional', 'sustituto', 'refuerzo'].includes(filters.estado) && line.estado !== filters.estado) return false;
        }
        return !q || window.employeeNorm(`${line.nombre} ${line.id} ${line.id_interno || ''}`).includes(q);
    });
    const sorters = {
        operativo: (a, b) => window.employeeStatusMeta(a.estado).rank - window.employeeStatusMeta(b.estado).rank || a.nombre.localeCompare(b.nombre),
        nombre: (a, b) => a.nombre.localeCompare(b.nombre),
        hotel: (a, b) => a.hotel.localeCompare(b.hotel) || a.nombre.localeCompare(b.nombre),
        noches: (a, b) => (b.resumen30d.noches || 0) - (a.resumen30d.noches || 0),
        vacaciones: (a, b) => (b.vacacionesUsadas || 0) - (a.vacacionesUsadas || 0),
        saldoVacaciones: (a, b) => (b.saldoVacaciones || 0) - (a.saldoVacaciones || 0),
        cambiosActivos: (a, b) => (b.cambiosActivos || 0) - (a.cambiosActivos || 0)
    };
    lines.sort(sorters[filters.sort] || sorters.operativo);
    const hotels = window._employeeLineHotels || [];
    const stateOptions = ['operativo', 'Activo', 'Vacaciones', 'Baja', 'apoyo', 'ocasional', 'sustituto', 'refuerzo', 'all'];
    area.innerHTML = `
        <div class="employees-dashboard line-mode">
            <div class="ed-summary">
                <div><span>Filas visibles</span><strong>${lines.length}</strong></div>
                <div><span>Activos</span><strong>${lines.filter(l => l.estado === 'Activo').length}</strong></div>
                <div><span>Incidencias</span><strong>${lines.filter(l => l.estado !== 'Activo').length}</strong></div>
                <div><span>Apoyo/Ocasional</span><strong>${lines.filter(l => ['apoyo', 'ocasional'].includes(l.tipoEmpleado)).length}</strong></div>
                <div><span>Refuerzos hoy</span><strong>${lines.filter(l => l.rolOperativo === 'refuerzo').length}</strong></div>
            </div>
            <div class="ed-tools">
                <input id="empLineSearch" type="search" value="${escapeHtml(filters.search)}" placeholder="Buscar nombre o ID">
                <select id="empLineHotel"><option value="all">Todos los hoteles</option>${hotels.map(h => `<option value="${escapeHtml(h)}" ${filters.hotel === h ? 'selected' : ''}>${escapeHtml(window.employeeShortHotel(h))}</option>`).join('')}</select>
                <select id="empLineEstado">${stateOptions.map(s => `<option value="${escapeHtml(s)}" ${filters.estado === s ? 'selected' : ''}>${escapeHtml(s === 'all' ? 'Todos los estados' : s === 'operativo' ? 'Operativo sin bajas' : s === 'apoyo' ? 'Tipo: Apoyo' : s === 'ocasional' ? 'Tipo: Ocasional' : s === 'sustituto' ? 'Rol: Sustituto' : s === 'refuerzo' ? 'Rol: Refuerzo' : s)}</option>`).join('')}</select>
                <select id="empLineSort">
                    <option value="operativo" ${filters.sort === 'operativo' ? 'selected' : ''}>Orden operativo</option>
                    <option value="nombre" ${filters.sort === 'nombre' ? 'selected' : ''}>Nombre</option>
                    <option value="hotel" ${filters.sort === 'hotel' ? 'selected' : ''}>Hotel</option>
                    <option value="noches" ${filters.sort === 'noches' ? 'selected' : ''}>Noches</option>
                    <option value="vacaciones" ${filters.sort === 'vacaciones' ? 'selected' : ''}>Vacaciones</option>
                    <option value="saldoVacaciones" ${filters.sort === 'saldoVacaciones' ? 'selected' : ''}>Saldo vacaciones</option>
                    <option value="cambiosActivos" ${filters.sort === 'cambiosActivos' ? 'selected' : ''}>Cambios activos</option>
                </select>
            </div>
            <div class="ed-actions">
                <button type="button" class="emp-new-btn" onclick="window.openNewEmployeeDrawer()"><i class="fas fa-user-plus"></i><span>Nuevo empleado</span></button>
                <span>Ficha inteligente con ID interno protegido.</span>
            </div>
        </div>
        <div class="employees-line-table advanced">
            <div class="emp-line-header advanced">
                <span>ID</span><span>Nombre</span><span>Hotel</span><span>Puesto</span><span>Tipo</span><span>Rol</span><span>Estado</span><span>Hoy</span><span>Proximo</span><span>Acciones</span>
            </div>
            ${lines.length ? lines.map(window.renderEmployeeLine).join('') : '<div class="employees-empty-line">No hay empleados para los filtros actuales.</div>'}
        </div>
    `;
    $('#empLineSearch')?.addEventListener('input', (e) => {
        window._employeeLineFilters.search = e.target.value;
        clearTimeout(window._employeeLineSearchTimer);
        window._employeeLineSearchTimer = setTimeout(() => window.renderEmployeeLineRows(), 260);
    });
    $('#empLineHotel')?.addEventListener('change', (e) => { window._employeeLineFilters.hotel = e.target.value; window.renderEmployeeLineRows(); });
    $('#empLineEstado')?.addEventListener('change', (e) => { window._employeeLineFilters.estado = e.target.value; window.renderEmployeeLineRows(); });
    $('#empLineSort')?.addEventListener('change', (e) => { window._employeeLineFilters.sort = e.target.value; window.renderEmployeeLineRows(); });
    if (restoreSearchFocus) {
        const search = document.getElementById('empLineSearch');
        search?.focus();
        const pos = String(window._employeeLineFilters.search || '').length;
        search?.setSelectionRange?.(pos, pos);
    }
};

window.populateEmployees = async () => {
    const area = $('#employeesContent'); if (!area) return;
    area.innerHTML = '<div style="padding:4rem; text-align:center;">Cargando empleados...</div>';
    try {
        const today = new Date();
        const end = new Date(); end.setDate(today.getDate() + 45);
        const start = new Date(); start.setDate(today.getDate() - 30);
        const startISO = window.isoDate(start) || start.toISOString().split('T')[0];
        const endISO = window.isoDate(end) || end.toISOString().split('T')[0];
        const todayISO = window.isoDate(today) || today.toISOString().split('T')[0];
        const [{ rows, eventos }, profilesResult, excelSource, hotelsList] = await Promise.all([
            window.TurnosDB.fetchRangoCalculado(startISO, endISO),
            window.TurnosDB.getEmpleados(),
            window.loadAdminExcelSourceRows(),
            window.TurnosDB.getHotels()
        ]);
        const profileByNorm = new Map();
        profilesResult.forEach(p => [p.id, p.nombre].forEach(v => {
            const n = window.employeeNorm(v);
            if (n && !profileByNorm.has(n)) profileByNorm.set(n, p);
        }));
        const dates = [];
        let curr = new Date(start);
        while (curr <= end) {
            dates.push(window.isoDate(curr) || curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
        }
        const stats = {};
        const getStat = (empName, hotelName) => {
            const norm = window.employeeNorm(empName);
            if (!norm) return null;
            const profile = profileByNorm.get(norm);
            const key = window.employeeNorm(profile?.id || empName);
            if (!stats[key]) stats[key] = { id: profile?.id || empName, emp: profile?.nombre || empName, hotel: hotelName || profile?.hotel_id || 'Sin hotel', m: 0, t: 0, n: 0, v: 0, d: 0, b: 0, p: 0, history: [], eventos: [] };
            if (hotelName && stats[key].hotel === 'Sin hotel') stats[key].hotel = hotelName;
            return stats[key];
        };
        hotelsList.forEach(hName => {
            dates.forEach(date => {
                const hotelExcelRows = excelSource[hName] || [];
                const weekSeed = hotelExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));
                if (!weekSeed) return;
                const weekStartIso = weekSeed.weekStart;
                const fechasSemana = window.getFechasSemana(weekStartIso);
                const sourceIndex = Math.max(0, fechasSemana.indexOf(date));
                const weekExcelRows = hotelExcelRows.filter(r => r.weekStart === weekStartIso);
                if (!weekExcelRows.length) return;
                const dayRoster = window.TurnosEngine.buildDayRoster({ rows, events: eventos, employees: profilesResult, date, hotel: hName, sourceRows: weekExcelRows, sourceIndex });
                dayRoster.forEach(entry => {
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (!s) return;
                    const cell = entry.cell || {};
                    let label = cell.turno || '';
                    if (cell.tipo && cell.tipo !== 'NORMAL' && cell.tipo !== 'CT') label = cell.tipo;
                    const cls = window.TurnosRules ? window.TurnosRules.shiftKey(label, cell.tipo) : '';
                    if (date <= todayISO) {
                        if (cls === 'm') s.m++;
                        else if (cls === 't') s.t++;
                        else if (cls === 'n') s.n++;
                        else if (cls === 'v') s.v++;
                        else if (cls === 'd') s.d++;
                        else if (cls === 'b') s.b++;
                        else if (String(cell.tipo || '').toUpperCase().startsWith('PERM')) s.p++;
                    }
                    s.history.push({ fecha: date, turno: label || '', cls: cls || 'x', cell });
                });
            });
        });
        profilesResult.forEach(profile => {
            const s = getStat(profile.id || profile.nombre, profile.hotel_id || profile.hotel || 'Sin hotel');
            if (s) { s.id = profile.id || s.id; s.emp = profile.nombre || s.emp; }
        });
        eventos.forEach(ev => {
            [ev.empleado_id, ev.empleado_destino_id, ev.sustituto, ev.sustituto_id, ev.payload?.empleado_destino_id, ev.payload?.sustituto].forEach(empId => {
                const profile = profileByNorm.get(window.employeeNorm(empId));
                const s = getStat(profile?.id || profile?.nombre || empId, ev.hotel_origen || ev.hotel_destino || profile?.hotel_id || 'Sin hotel');
                if (s) s.eventos.push(ev);
            });
        });
        const models = Object.values(stats).map(s => {
            const profile = profileByNorm.get(window.employeeNorm(s.id)) || profileByNorm.get(window.employeeNorm(s.emp)) || {};
            return window.buildEmployeeLineModel({ stats: s, profile, todayISO, eventos: s.eventos });
        });
        window._employeeLineModels = models;
        window._employeeLineHotels = [...new Set(models.map(m => m.hotel).filter(Boolean))].sort();
        window._lastStats = Object.fromEntries(models.map(model => [String(model.id), model]));
        window.renderEmployeeLineRows();
    } catch (e) {
        area.innerHTML = `<div style="color:red; padding:2rem;">Error cargando empleados: ${escapeHtml(e.message)}</div>`;
        console.error(e);
    }
};

window.renderEmployeeHistoryItem = (h) => `
    <div class="history-item compact">
        <div class="hi-date"><span class="hi-day">${new Date(`${h.fecha}T12:00:00`).toLocaleDateString('es-ES', {day:'2-digit'})}</span><span class="hi-month">${new Date(`${h.fecha}T12:00:00`).toLocaleDateString('es-ES', {month:'short'}).replace('.','').toUpperCase()}</span></div>
        <div class="hi-info"><div class="sc-label">${window.employeeShiftBadge(h.turno || '')}</div></div>
        <div class="hi-type">${h.cell?.cambio ? '<span class="emp-change-icon">�x</span>' : ''}</div>
    </div>
`;

// ==========================================
// 11. MOTOR DE CONFLICTOS OPERATIVOS
// ==========================================

/**
 * Motor de Conflictos V3: Análisis contextual y agrupado.
 * Evita ruido y prioriza la operativa real.
 */
window.detectarConflictosOperativos = async (fecha, hotel, inputEventos = null, inputResolveId = null) => {
    const groupedConflicts = {
        CRITICAL: [],
        WARNING: [],
        INFO: []
    };
    
    // V12.5.2: Garantizar contexto si no se pasa explícitamente (ej. desde publicación)
    let eventos = inputEventos;
    let resolveId = inputResolveId;
    let emps = (window._employeeLineModels || []).filter(e => e.activo !== false && (hotel === 'TODOS' || e.hotel === hotel));
    
    if (!eventos) {
        const today = window.isoDate(new Date());
        eventos = await window.TurnosDB.fetchEventos(window.addIsoDays(today, -30), window.addIsoDays(today, 60));
    }

    if (!resolveId) {
        const profiles = await window.TurnosDB.getEmpleados();
        const idMap = new Map();
        const nameToIds = new Map();
        profiles.forEach(p => {
            const normId = window.normalizeId(p.id);
            const normName = window.normalizeId(p.nombre);
            idMap.set(normId, p.id);
            if (!nameToIds.has(normName)) nameToIds.set(normName, new Set());
            nameToIds.get(normName).add(p.id);
        });
        resolveId = (raw) => {
            const norm = window.normalizeId(raw);
            if (idMap.has(norm)) return idMap.get(norm);
            const ids = nameToIds.get(norm);
            return (ids && ids.size === 1) ? Array.from(ids)[0] : norm;
        };
    }
    
    const todayISO = window.isoDate(new Date());

    // 1. Análisis de Integridad (Agrupado)
    // Filtramos empleados reales (excluyendo plazas pendientes como '¿?') que no tengan ID Interno
    const empsSinId = emps.filter(e => (!e.id_interno || String(e.id_interno).trim() === '') && e.id !== '¿?');
    if (empsSinId.length > 0) {
        groupedConflicts.CRITICAL.push({
            type: 'SIN_ID',
            count: empsSinId.length,
            title: 'Mapeo de Identidad Pendiente',
            desc: `Existen ${empsSinId.length} perfiles operativos sin identificador único persistente (id_interno).`,
            suggestion: 'Asigna un código EMP-XXXX desde la ficha de cada empleado para asegurar la integridad histórica.',
            action: { label: 'Ir a Personal', fn: 'window.switchSection("employees")' }
        });
    }

    // 2. Análisis por Empleado (Contextual)
    for (const emp of emps) {
        const empId = emp.id || emp.nombre;
        // Ignorar sustitutos o refuerzos si el nombre contiene marcas temporales (ej. "REF-")
        if (String(empId).includes('REF-') || String(emp.tipo || '').toLowerCase().includes('refuerzo')) continue;

        const info = window.resolveEmployeeDay ? window.resolveEmployeeDay({
            empleado: emp,
            empleadoId: empId,
            fecha,
            eventos: emp.events,
            allEvents: eventos,
            resolveId: resolveId
        }) : null;
        
        // A. Ausencia de Turno Crítica
        // Solo para fijos con jornada completa y >2 días de vacío total
        if (!info || (!info.turno && !info.incidencia)) {
            const isFijoCompleto = String(emp.tipo || '').toLowerCase().includes('fijo') && !String(emp.tipo || '').toLowerCase().includes('parcial');
            
            if (isFijoCompleto) {
                const history = emp.history || [];
                const lastDays = [...history].sort((a,b) => b.fecha.localeCompare(a.fecha))
                    .filter(h => h.fecha < fecha).slice(0, 2);
                
                const gapCount = lastDays.filter(h => !h.turno && !h.incidencia).length;
                if (gapCount >= 2) {
                    groupedConflicts.CRITICAL.push({
                        type: 'SIN_TURNO',
                        empId, fecha,
                        title: 'Falta de Programación Crítica',
                        desc: `${emp.nombre} lleva >2 días sin asignación ni descanso registrado.`,
                        suggestion: 'Asignar turno o marcar Descanso (D) para evitar incidencias legales.'
                    });
                }
            }
        }

        // B. Regla de Jornada Progresiva (5d/6d/7+)
        // Solo cuenta como trabajo: cls 'm' (Mañana), 't' (Tarde), 'n' (Noche).
        // '�', D, VAC, BAJA, PERM no son trabajo.
        const WORK_CLS = new Set(['m', 't', 'n']);
        const esTurnoLaboral = (h) => WORK_CLS.has(h?.cls);

        let workedDays = 0;
        if (info && esTurnoLaboral({ cls: window.TurnosRules?.shiftKey(info.turno || '', 'NORMAL') })) {
            const history = emp.history || [];
            const sortedHistory = [...history].sort((a, b) => b.fecha.localeCompare(a.fecha));
            const before = sortedHistory.filter(h => h.fecha < fecha).slice(0, 8);
            
            workedDays = 1;
            const diasContados = [fecha];
            for (const h of before) {
                if (esTurnoLaboral(h)) {
                    workedDays++;
                    diasContados.push(h.fecha);
                } else {
                    break; // cadena rota: parar
                }
            }

            if (workedDays >= 7) {
                groupedConflicts.CRITICAL.push({ type: 'JORNADA', severity: 'CRITICAL', empId, title: 'Riesgo Laboral Extremo', desc: `${emp.nombre} lleva ${workedDays} días laborales seguidos (${diasContados.slice(0,3).join(', ')}...).`, suggestion: 'Bloquear jornada y asignar descanso hoy.' });
            } else if (workedDays === 6) {
                groupedConflicts.WARNING.push({ type: 'JORNADA', severity: 'WARNING', empId, title: 'Exceso de Jornada', desc: `${emp.nombre} lleva 6 días laborales: ${diasContados.join(', ')}.`, suggestion: 'Programar descanso mañana.' });
            } else if (workedDays === 5) {
                groupedConflicts.INFO.push({ type: 'JORNADA', severity: 'INFO', empId, title: 'Próximo a límite (5d)', desc: `${emp.nombre} cumplirá 5 días laborales hoy.`, suggestion: 'Sugerido descanso en 48h.' });
            }
        }
    }

    // 3. Cobertura Crítica (Turnos Clave)
    const shiftsBySlot = {};
    for (const emp of emps) {
        const infoArr = window.resolverTurnoFinal ? window.resolverTurnoFinal({ 
            empleado: emp,
            empleadoId: (emp.id || emp.nombre),
            fecha,
            eventos: emp.events
        }) : null;
        const info = (Array.isArray(infoArr) ? infoArr[0] : infoArr) || null;
        if (info && info.turno && info.turno !== 'D') {
            const key = `${info.turno}_${emp.puesto}`;
            if (!shiftsBySlot[key]) shiftsBySlot[key] = [];
            shiftsBySlot[key].push(emp.nombre);
        }
    }

    // Verificar "Noche Recepción"
    const nocheRecepcion = Object.keys(shiftsBySlot).find(k => k.includes('Noche') && k.includes('Recep'));
    if (!nocheRecepcion) {
        groupedConflicts.CRITICAL.push({
            type: 'COBERTURA',
            title: 'Turno Clave sin Cobertura',
            desc: 'No hay nadie asignado al turno de Noche en Recepción hoy.',
            suggestion: 'Asignar un recepcionista o retén de emergencia.'
        });
    }

    // 4. Duplicidad (Solo si hay capacidad definida)
    Object.entries(shiftsBySlot).forEach(([key, names]) => {
        const puestoKey = key.split('_')[1];
        const capacidad = window._puestosCapacityMap ? window._puestosCapacityMap[puestoKey] : null;
        
        if (capacidad && names.length > capacidad) {
            groupedConflicts.WARNING.push({
                type: 'DUPLICADO',
                title: 'Exceso de Capacidad',
                desc: `Puesto ${puestoKey} superado (${names.length}/${capacidad}).`,
                suggestion: 'Mover refuerzo a otro hotel o sección.'
            });
        }
    });

    return groupedConflicts;
};

// ==========================================
// 12. PUBLISH TO SUPABASE WORKFLOW
// ==========================================

window.getExcelDiff = () => {
    const original = window._adminExcelBaseOriginalRows || {};
    const edited = window._adminExcelEditableRows || {};
    const changes = [];
    const hotels = Object.keys(edited);

    hotels.forEach(hotel => {
        const editedRows = edited[hotel] || [];
        const originalRows = original[hotel] || [];

        editedRows.forEach(row => {
            const orig = originalRows.find(r => r.weekStart === row.weekStart && r.rowIndex === row.rowIndex);
            if (!orig) return;

            const nameChanged = row.displayName !== orig.displayName;
            const shiftsChanged = row.values.some((v, i) => v !== orig.values[i]);

            if (nameChanged || shiftsChanged) {
                changes.push({ 
                    hotel, 
                    type: 'edit', 
                    row, 
                    orig, 
                    nameChanged, 
                    shiftsChanged,
                    weekStart: row.weekStart,
                    displayName: row.displayName
                });
            }
        });
    });
    return changes;
};

window.showPublishPreview = async () => {
    // 1. Identificar rango y hotel
    const hotelSel = $('#prevHotel')?.value || 'all';
    const rawDate = window._previewDate;
    if (!rawDate) {
        alert('Por favor, selecciona una semana en Vista Previa primero.');
        return;
    }
    const base = new Date(rawDate + 'T12:00:00');
    const weekStart = window.isoDate(window.getMonday(base));
    const weekEnd = window.addIsoDays(weekStart, 6);

    // 2. Generar Snapshot Preview (Sin guardar)
    let snapshots = [];
    try {
        snapshots = await window.buildPublicationSnapshotPreview(weekStart, hotelSel);
    } catch (e) {
        alert('Error al generar la previsualización del snapshot: ' + e.message);
        return;
    }

    if (snapshots.length === 0) {
        alert('No hay datos operativos para publicar en esta selección.');
        return;
    }

    // 3. Validar Snapshot (Bloqueante)
    const validation = await window.validatePublicationSnapshot(snapshots);
    
    // 4. Crear Modal de Publicación
    const modalId = 'publishPreviewModal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'drawer-overlay';
        modal.style.zIndex = '9999';
        document.body.appendChild(modal);
    }

    const hotelSummary = snapshots.map(s => `
        <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 800; color: #0f172a;">${s.hotel_nombre}</span>
                <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">${s.rows.length} filas</span>
            </div>
        </div>
    `).join('');

    const validationHtml = validation.ok 
        ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 16px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">
             <i class="fas fa-check-circle" style="font-size: 1.2rem;"></i>
             <div>
                <strong style="display: block;">Integridad Validada</strong>
                <span style="font-size: 0.85rem;">El snapshot cumple con todas las reglas de protección.</span>
             </div>
           </div>`
        : `<div style="background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
             <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <i class="fas fa-times-circle" style="font-size: 1.2rem;"></i>
                <strong>Errores Críticos Detectados</strong>
             </div>
             <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; line-height: 1.5;">
                ${validation.errors.map(e => `<li>${e}</li>`).join('')}
             </ul>
           </div>`;

    const warningsHtml = validation.warnings.length > 0
        ? `<div style="background: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
             <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.1rem;"></i>
                <strong style="font-size: 0.9rem;">Advertencias de Cobertura</strong>
             </div>
             <ul style="margin: 0; padding-left: 20px; font-size: 0.8rem; opacity: 0.9;">
                ${validation.warnings.slice(0, 5).map(w => `<li>${w}</li>`).join('')}
                ${validation.warnings.length > 5 ? `<li>... y ${validation.warnings.length - 5} avisos más.</li>` : ''}
             </ul>
           </div>`
        : '';

    modal.innerHTML = `
        <div class="drawer-content" style="max-width: 600px; padding: 0; border-radius: 24px; overflow: hidden; background: #f8fafc;">
            <header style="padding: 24px 32px; background: #0f172a; color: white;">
                <h2 style="margin: 0; font-size: 1.25rem;">🚀 Publicar Snapshot de Turnos</h2>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.8;">Semana del ${weekStart} al ${weekEnd}</p>
            </header>
            
            <div style="padding: 32px; overflow-y: auto; max-height: 65vh;">
                ${validationHtml}
                ${warningsHtml}

                <section style="margin-bottom: 24px;">
                    <h3 style="font-size: 0.85rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em;">Hoteles Incluidos</h3>
                    ${hotelSummary}
                </section>

                <div style="background: #eff6ff; border: 1px solid #dbeafe; padding: 16px; border-radius: 12px; font-size: 0.85rem; color: #1e40af;">
                    <strong>Nota:</strong> Al publicar, se creará una versión inmutable (Snapshot) que será la única fuente de verdad para el Cuadrante Público. Los cambios locales en el Excel también se sincronizarán con la base de datos.
                </div>
            </div>

            <footer style="padding: 24px 32px; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px;">
                <button onclick="document.getElementById('${modalId}').classList.remove('open')" style="padding: 12px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; font-weight: 700; cursor: pointer; color: #64748b;">Cancelar</button>
                <button id="btnConfirmPublish" 
                        onclick="window.publishToSupabase()" 
                        ${!validation.ok ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                        style="padding: 12px 32px; border: none; border-radius: 12px; background: #3b82f6; color: white; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                    Confirmar y Publicar
                </button>
            </footer>
        </div>
    `;

    modal.classList.add('open');
};

window.publishToSupabase = async () => {
    const btn = document.getElementById('btnConfirmPublish');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Publicando...';
        btn.style.opacity = '0.7';
    }

    try {
        const hotelSel = $('#prevHotel')?.value || 'all';
        const rawDate = window._previewDate;
        const base = new Date(rawDate + 'T12:00:00');
        const weekStart = window.isoDate(window.getMonday(base));

        // 1. Generar Snapshots finales
        const snapshots = await window.buildPublicationSnapshotPreview(weekStart, hotelSel);
        
        // 2. Sincronizar cambios de Excel (turnos crudos)
        const changes = window.getExcelDiff();
        if (changes.length > 0) {
            const flatData = [];
            changes.forEach(c => {
                const dates = window.getFechasSemana(c.weekStart);
                dates.forEach((f, i) => {
                    if (c.row.values[i] !== c.orig.values[i]) {
                        flatData.push({
                            empleado_id: c.displayName,
                            fecha: f,
                            turno: c.row.values[i] || '',
                            tipo: 'NORMAL',
                            hotel_id: c.hotel
                        });
                    }
                });
            });
            if (flatData.length > 0) {
                await window.TurnosDB.bulkUpsert(flatData);
                await window.TurnosDB.insertLog({
                    cambios_totales: flatData.length,
                    empleados_afectados: new Set(changes.map(c => c.displayName)).size,
                    estado: 'ok'
                });
            }
        }

        // 3. Guardar Snapshots en publicaciones_cuadrante
        for (const snap of snapshots) {
            await window.TurnosDB.publishCuadranteSnapshot({
                semanaInicio: snap.week_start,
                semanaFin: snap.week_end,
                hotel: snap.hotel_id,
                snapshot: snap,
                resumen: { emps: snap.rows.length },
                usuario: 'ADMIN'
            });
        }

        // 4. Actualizar estado local
        window._adminExcelBaseOriginalRows = window.cloneExcelRows(window._adminExcelEditableRows);
        
        alert('Publicación completada con éxito.');
        document.getElementById('publishPreviewModal')?.classList.remove('open');
        
        window.renderExcelView();
        window.renderPreview();
        window.renderDashboard();

    } catch (error) {
        console.error('Error en publicación:', error);
        alert('Error al publicar: ' + error.message);
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Confirmar y Publicar';
            btn.style.opacity = '1';
        }
    }
};

window.validatePublishChanges = (changes) => {
    const errors = [];
    const validShifts = new Set(['M', 'T', 'N', 'D', 'VAC', 'BAJA', 'PERM', '']);

    changes.forEach(c => {
        // 1. Empleados sin ID
        if (!c.displayName || c.displayName === '?' || c.displayName.length < 2) {
            errors.push(`Empleado con nombre inválido en ${c.weekStart}: "${c.displayName}"`);
        }

        // 2. Fechas inconsistentes (ya se filtran en ExcelLoader pero re-verificamos)
        if (!c.weekStart || isNaN(new Date(c.weekStart).getTime())) {
            errors.push(`Fecha de semana inválida para ${c.displayName}: ${c.weekStart}`);
        }

        // 3. Turnos inválidos
        c.row.values.forEach((v, idx) => {
            const vNorm = String(v || '').toUpperCase().trim();
            if (vNorm && !validShifts.has(vNorm) && !vNorm.includes('x ️')) {
                // Permitimos valores que no estén en el set si son descriptivos, 
                // pero alertamos si parecen basura
                if (vNorm.length > 10) errors.push(`Turno sospechoso en ${c.weekStart} (${c.displayName}): ${vNorm}`);
            }
        });
    });

    return errors;
};

    /**
     * TAREA CODEX: Función central para generar el snapshot exacto de lo que se ve en Admin.
     * Genera el JSON sin guardarlo, para previsualización y validación.
     */
    window.buildPublicationSnapshotPreview = async (weekStart, hotelName = 'all') => {
        const cache = window._lastRenderedPreviewSnapshotSource;
        const hotels = await window.TurnosDB.getHotels();
        const hotelsToProcess = hotelName === 'all' ? hotels : [hotelName];
        
        const snapshots = [];
        const weekEnd = window.addIsoDays(weekStart, 6);
        const dates = [0,1,2,3,4,5,6].map(i => window.addIsoDays(weekStart, i));

        for (const hName of hotelsToProcess) {
            // Intentar recuperar del cache del render actual
            let hotelData = null;
            if (cache && cache.hoteles && cache.semana_inicio === weekStart) {
                const found = cache.hoteles.find(h => h.hotel === hName);
                if (found) hotelData = found.empleados;
            }

            // Si no hay cache (o forzamos reconstrucción), regenerar modelo fiel
            if (!hotelData) {
                console.warn(`[SNAPSHOT] Regenerando datos para ${hName} (no cache found)`);
                const profiles = await window.TurnosDB.getEmpleados();
                const excelSource = await window.loadAdminExcelSourceRows();
                const weekExcelRows = (excelSource[hName] || []).filter(r => r.weekStart === weekStart);
                const { rows: data } = await window.TurnosDB.fetchRangoCalculado(weekStart, weekEnd);
                const eventos = window.eventosGlobales || await window.TurnosDB.fetchEventos(weekStart, weekEnd);

                const previewModel = window.createPuestosPreviewModel({
                    hotel: hName,
                    dates: dates,
                    sourceRows: weekExcelRows,
                    rows: data.filter(r => r.hotel_id === hName),
                    eventos,
                    employees: profiles
                });

                if (previewModel.puestos.length === 0) continue;

                const emps = previewModel.getEmployees();
                const seen = new Set();
                const deduplicated = emps.filter(e => {
                    const key = e.employee_id;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                hotelData = deduplicated.map((emp, idx) => {
                    const daysMap = {};
                    dates.forEach(fecha => {
                        // REGLA DE ORO V12.1: Siempre resolver para el ID del ocupante de esta fila (emp.employee_id).
                        // El motor (getTurnoEmpleadoExtended) ya se encarga de heredar el turno del titular
                        // si este empleado es un sustituto. Si resolvemos para el titular, obtendríamos
                        // su incidencia (VAC/BAJA), lo cual es incorrecto para la fila operativa del sustituto.
                        const resolveId = emp.employee_id;
                                                const resolved = previewModel.getTurnoEmpleado(resolveId, fecha);
                        
                        // DEBUG LOG for Natalio (Tuesday 28/04/26)
                        if (fecha === '2026-04-28' && (resolveId === 'EMP-0006' || String(resolveId).includes('Natalio'))) {
                            console.log('[PIN_DEBUG snapshot] Natalio 2026-04-28', {
                                turno: resolved.turno,
                                icon: resolved.icon,
                                icons: resolved.icons,
                                cambio: resolved.cambio,
                                isCoverageMarker: resolved.isCoverageMarker
                            });
                        }

                        const visual = window.TurnosRules ? window.TurnosRules.describeCell(resolved) : { label: resolved.turno, icons: resolved.icons || [] };
                        
                        // B4 FIX: Garantizar códigos canónicos para ausencias.
                        const absCode = resolved.incidencia
                            ? (resolved.incidencia === 'PERMISO' ? 'PERM'
                               : resolved.incidencia === 'FORMACION' ? 'FORM'
                               : resolved.incidencia === 'BAJA' ? 'BAJA'
                               : resolved.incidencia === 'VAC' ? 'VAC'
                               : resolved.incidencia)
                            : null;

                        daysMap[fecha] = {
                            label: visual.label || absCode || resolved.turno || '',
                            code: absCode || resolved.turno || '',
                            icons: (visual.icons && visual.icons.length > 0) ? visual.icons : (visual.icon ? [visual.icon] : (resolved.icon ? [resolved.icon] : (resolved.icons || []))),
                            type: resolved.incidencia || 'NORMAL',
                            changed: !!resolved.cambio,
                            isAbsence: !!resolved.incidencia,
                            isRefuerzo: !!resolved.isRefuerzo,
                            titular_cubierto: resolved.titular || null,
                            sustituto: resolved.sustituidoPor || null,
                            origen: resolved.origen || 'base'
                        };
                    });
                    
                    const profile = profiles.find(p => window.normalizeId(p.id) === window.normalizeId(emp.employee_id) || window.normalizeId(p.nombre) === window.normalizeId(emp.employee_id));
                    
                    return {
                        rowType: emp.rowType || 'operativo',
                        puestoOrden: emp.puestoOrden || (idx + 1),
                        nombreVisible: emp.nombre || emp.employee_id,
                        nombre: emp.nombre || emp.employee_id, // Alias legacy
                        empleado_id: emp.employee_id,
                        titularOriginalId: emp.titularOriginalId,
                        cells: daysMap,
                        dias: daysMap, // Alias legacy
                        // Metadatos adicionales para el index
                        tipo_personal: profile?.tipo_personal || null,
                        puesto: profile?.puesto || null,
                        excludeCounters: window.isEmpleadoOcasionalOApoyo && window.isEmpleadoOcasionalOApoyo(profile),
                        origenOrden: emp.origenOrden || null,
                        evento_id: emp.evento_id || null
                    };
                });
            } else {
                // TAREA CODEX: El cache debe preservar la integridad estructural de V12
                hotelData = hotelData.map(emp => ({
                    ...emp,
                    rowType: emp.rowType || 'operativo',
                    puestoOrden: emp.puestoOrden || emp.orden || 999,
                    nombreVisible: emp.nombreVisible || emp.nombre,
                    nombre: emp.nombre,
                    cells: emp.cells || emp.dias,
                    dias: emp.cells || emp.dias
                }));
            }

            snapshots.push({
                hotel_id: hName,
                hotel_nombre: hName,
                week_start: weekStart,
                week_end: weekEnd,
                source: 'admin_preview_resolved',
                rows: hotelData
            });
        }
        return snapshots;
    };

    /**
     * TAREA CODEX: Validaciones bloqueantes antes de publicar.
     * Retorna { ok: boolean, errors: [] }
     */
    window.validatePublicationSnapshot = async (snapshots) => {
        const errors = [];
        const warnings = [];
        const validCodes = new Set(['M', 'T', 'N', 'D', 'VAC', 'BAJA', 'PERM', 'FORM', 'CT', '\u2014', '']);
        
        for (const snap of snapshots) {
            const hName = snap.hotel_nombre;
            
            // [J] No "TEST HOTEL"
            if (hName.toLowerCase().includes('test')) {
                errors.push(`[BLOQUEO] No se permite publicar hoteles de prueba: ${hName}`);
            }

            snap.rows.forEach(row => {
                const empName = row.nombreVisible;
                
                // [C] No missing IDs
                if (!row.empleado_id || row.empleado_id === '?' || row.empleado_id.length < 2) {
                    errors.push(`[BLOQUEO] Empleado sin ID válido: "${empName}" en ${hName}`);
                }

                // [I] No _DUP
                if (empName.includes('_DUP')) {
                    errors.push(`[BLOQUEO] Nombre contiene marcador de duplicado (_DUP): "${empName}"`);
                }

                // [K] Validación de Extras Justificados
                const isExtra = row.rowType === 'extra' || row.rowType === 'refuerzo' || row.origenOrden === 'auto_extra';
                if (isExtra && !row.evento_id) {
                    errors.push(`[BLOQUEO] Fila extra sin justificación explícita (sin evento): "${empName}" en ${hName}`);
                }

                // [L] EMP-XXXX Visibility Check
                const isEMPId = (str) => /EMP-\d{4}/i.test(String(str || ''));
                if (isEMPId(row.nombreVisible) || isEMPId(row.nombre)) {
                    errors.push(`[BLOQUEO] ID interno visible en cabecera: "${row.nombreVisible || row.nombre}" en ${hName}`);
                }

                Object.entries(row.cells).forEach(([fecha, cell]) => {
                    const code = String(cell.code || '').toUpperCase().trim();
                    
                    // [D] No illegal codes
                    if (code && !validCodes.has(code) && !code.includes('\uFFFD')) {
                        // Si es algo muy raro, bloqueamos
                        if (code.length > 8) {
                            errors.push(`[BLOQUEO] Código de turno ilegal: "${code}" para ${empName} el ${fecha}`);
                        }
                    }

                    // [L] EMP-XXXX Visibility Check in cell
                    if (isEMPId(cell.label)) {
                        errors.push(`[BLOQUEO] ID interno visible en celda: "${cell.label}" para ${empName} el ${fecha}`);
                    }

                    // [F] Critical coverage (Absence without substitute)
                    if (cell.isAbsence && !cell.sustituto) {
                        // REGLA: Las vacantes son avisos operativos, no bloqueos automáticos
                        warnings.push(`[AVISO] Ausencia sin sustituto: ${empName} (${cell.type}) el ${fecha}`);
                    }
                });
                
                // [N] Validación de Filas Vacías (Regla 6)
                const cellsArray = Object.values(row.cells);
                const hasAnyContent = cellsArray.some(c => {
                    const code = (c.code || '').toUpperCase().trim();
                    return code && code !== '\u2014' && code !== '—' && code !== '';
                });

                if (row.rowType === 'operativo' && !hasAnyContent) {
                    errors.push(`[BLOQUEO] Fila operativa sin turnos (vacía): "${empName}" en ${hName}`);
                }
                
                if (row.rowType === 'ausencia_informativa') {
                    const hasIncidence = cellsArray.some(c => c.isAbsence || ['VAC','BAJA','PERM','FORM','IT'].includes((c.type || '').toUpperCase()));
                    if (!hasIncidence) {
                        errors.push(`[BLOQUEO] Fila informativa de ausencia sin incidencias visibles: "${empName}" en ${hName}`);
                    }
                }

                if (row.rowType === 'refuerzo' && !hasAnyContent) {
                    errors.push(`[BLOQUEO] Fila de refuerzo sin turnos: "${empName}" en ${hName}`);
                }
            });

            // [M] Validación de Cobertura Obligatoria de Eventos (B2/B3 FIX)
            // B2: snap usa week_start/week_end/hotel_id, NO semana_inicio/semana_fin/hotel
            // B3: normalizar estado del evento con normalizeEstado(); comparar hotel con hotel_id
            const events = window.eventosGlobales || [];
            const wStart = snap.week_start || snap.semana_inicio || '';
            const wEnd   = snap.week_end   || snap.semana_fin   || '';
            const snapHotelId = snap.hotel_id || snap.hotel || snap.hotel_nombre || '';

            events.forEach(ev => {
                if (window.normalizeEstado(ev.estado) === 'anulado') return;
                // Filtro de hotel: usar normalizeId + todos los campos posibles del evento
                const evHotel = window.normalizeId(window.getEventoHotel ? window.getEventoHotel(ev) : (ev.hotel || ev.hotel_origen || ev.hotel_destino || ev.payload?.hotel_id || ''));
                const snapHotelNorm = window.normalizeId(snapHotelId);
                if (evHotel && snapHotelNorm && evHotel !== snapHotelNorm) return;

                const tipoEv = window.normalizeTipo(ev.tipo);
                if (!['VAC', 'BAJA', 'PERM', 'PERMISO'].includes(tipoEv)) return;

                // Intersección con la semana
                const evStart = window.normalizeDate ? window.normalizeDate(ev.fecha_inicio) : (ev.fecha_inicio || '');
                const evEnd   = window.normalizeDate ? window.normalizeDate(ev.fecha_fin || ev.fecha_inicio) : (ev.fecha_fin || ev.fecha_inicio || '');
                if (!evStart || !wStart || evStart > wEnd || evEnd < wStart) return;

                const idNorm = window.normalizeId(ev.empleado_id);
                const row = snap.rows.find(r => window.normalizeId(r.empleado_id) === idNorm);

                if (!row) {
                    errors.push(`[BLOQUEO] Evento ${tipoEv} de ${ev.empleado_id} no aparece en el snapshot de ${snapHotelId}`);
                } else {
                    // Verificar que cada día de la ausencia tenga el código correcto en el snapshot
                    const cellDates = Object.keys(row.cells).filter(d =>
                        d >= evStart && d <= evEnd && d >= wStart && d <= wEnd
                    );
                    cellDates.forEach(d => {
                        const cell = row.cells[d];
                        if (!cell) {
                            errors.push(`[BLOQUEO] Celda faltante para ${row.nombreVisible} el ${d} (evento ${tipoEv})`);
                            return;
                        }
                        const code = String(cell.code || '').toUpperCase();
                        const type = String(cell.type || '').toUpperCase();

                        // Códigos esperados: VAC→VAC, BAJA→BAJA, PERMISO/PERM→PERM
                        const expectedCodes = { 'VAC': 'VAC', 'BAJA': 'BAJA', 'PERMISO': 'PERM', 'PERM': 'PERM' };
                        const expected = expectedCodes[tipoEv];

                        const isRendered = expected && (code === expected || code.startsWith(expected) || type === expected);
                        if (!isRendered) {
                            errors.push(`[BLOQUEO] Evento ${tipoEv} no renderizado para ${row.nombreVisible} el ${d} — snapshot tiene code="${code}" type="${type}"`);
                        }
                    });
                }
            });

            // [O] Validación de Consistencia de Cambios de Turno / Intercambios
            events.forEach(ev => {
                if (window.normalizeEstado(ev.estado) === 'anulado') return;
                const tipoEv = window.normalizeTipo(ev.tipo);
                if (tipoEv !== 'CAMBIO_TURNO' && tipoEv !== 'INTERCAMBIO_TURNO') return;

                const evStart = window.normalizeDate ? window.normalizeDate(ev.fecha_inicio) : (ev.fecha_inicio || '');
                if (!evStart || !wStart || evStart > wEnd || evStart < wStart) return;

                const idOrig = window.normalizeId(ev.empleado_id);
                const idDest = window.normalizeId(ev.empleado_destino_id || ev.sustituto_id);
                
                const rowOrig = snap.rows.find(r => window.normalizeId(r.empleado_id) === idOrig);
                const rowDest = idDest ? snap.rows.find(r => window.normalizeId(r.empleado_id) === idDest) : null;

                const checkCell = (row, id, role) => {
                    if (!row) return; 
                    const cell = row.cells[evStart];
                    if (!cell) return;
                    const isChanged = !!cell.changed || !!cell.intercambio || (cell.origen && cell.origen.includes('CAMBIO'));
                    const hasIcon = Array.isArray(cell.icons) && cell.icons.includes('🔄');
                    if (!isChanged && !hasIcon) {
                        errors.push(`[BLOQUEO] El ${role} del cambio (${id}) no muestra el icono 🔄 el ${evStart} en ${snapHotelId}`);
                    }
                };

                checkCell(rowOrig, ev.empleado_id, 'Origen');
                if (idDest) checkCell(rowDest, ev.empleado_destino_id || ev.sustituto_id, 'Destino');

                // [O.1] Verificación de Existencia de Sustituto en Cuadrante
                if (idDest && !rowDest) {
                    errors.push(`[BLOQUEO] El sustituto ${idDest} para ${idOrig} el ${evStart} no existe en las filas del snapshot.`);
                }
            });
        }

        // [B] [E] Duplicados operativos y conflictos de localización
        const allEmps = {};
        snapshots.forEach(snap => {
            snap.rows.forEach(row => {
                const id = window.normalizeId(row.empleado_id);
                if (!allEmps[id]) allEmps[id] = [];
                Object.entries(row.cells).forEach(([fecha, cell]) => {
                    const code = String(cell.code || '').toUpperCase();
                    if (['M', 'T', 'N'].includes(code)) {
                        allEmps[id].push({ hotel: snap.hotel_nombre, fecha, code });
                    }
                });
            });
        });

        Object.entries(allEmps).forEach(([id, shifts]) => {
            const days = {};
            shifts.forEach(s => {
                if (!days[s.fecha]) days[s.fecha] = [];
                days[s.fecha].push(s);
            });
            Object.entries(days).forEach(([fecha, entries]) => {
                if (entries.length > 1) {
                    const hotels = entries.map(e => e.hotel).join(' y ');
                    errors.push(`[BLOQUEO] Duplicado operativo: ${id} tiene turnos en ${hotels} el ${fecha}`);
                }
            });
        });

        return {
            ok: errors.length === 0,
            errors,
            warnings
        };
    };

window.publishToSupabase = async () => {
    const btn = document.getElementById('btnConfirmPublish');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Validando...';
        btn.style.opacity = '0.7';
    }

    try {
        const changes = window.getExcelDiff();
        // Permitimos continuar si es una publicación manual (sin cambios de Excel)
        // if (changes.length === 0) throw new Error('No hay cambios para publicar.');

        // --- 1. VALIDACIÓN PRE-PUBLICACIÓN Y CONFLICTOS ---
        const validationErrors = window.validatePublishChanges ? window.validatePublishChanges(changes) : [];
        
        // Detección de conflictos operativos
        const conflicts = (await window.detectarConflictosOperativos(window.isoDate(new Date()), 'TODOS')) || [];
        const criticalConflicts = Array.isArray(conflicts) ? conflicts.filter(c => c.severity === 'CRITICAL') : [];
        
        if (validationErrors.length > 0 || criticalConflicts.length > 0) {
            let msg = '�a�️ AVISO DE INTEGRIDAD / CONFLICTOS:\n\n';
            if (validationErrors.length > 0) msg += `- ERRORES T�0CNICOS: ${validationErrors.length} detectados.\n`;
            if (criticalConflicts.length > 0) msg += `- CONFLICTOS OPERATIVOS: ${criticalConflicts.length} detectados.\n`;
            
            msg += '\nSe recomienda resolver estos puntos, pero puede continuar si es consciente de los riesgos.';
            
            if (!confirm(msg + '\n\n¿DESEA PUBLICAR IGUALMENTE?')) {
                throw new Error('Publicación cancelada por el usuario');
            }
        } else {
            const confirmMsg = changes.length > 0 
                ? `¿Confirmas la publicación de ${changes.length} cambios?`
                : `¿Confirmas la publicación del snapshot para la semana actual?`;
            if (!confirm(confirmMsg)) return;
        }

        if (btn) btn.textContent = 'Preparando trazabilidad...';

        const flatData = [];
        const traceabilityDetails = [];
        const affectedEmps = new Set();

        changes.forEach(c => {
            affectedEmps.add(c.displayName);
            const weekDates = window.getFechasSemana(c.weekStart);
            
            weekDates.forEach((fecha, idx) => {
                const turnoNuevo = c.row.values[idx] || '';
                const turnoAnterior = c.orig.values[idx] || '';

                if (turnoNuevo !== turnoAnterior) {
                    flatData.push({
                        empleado_id: c.displayName,
                        fecha: fecha,
                        turno: turnoNuevo,
                        tipo: 'NORMAL',
                        hotel_id: c.hotel
                    });

                    traceabilityDetails.push({
                        empleado_id: c.displayName,
                        fecha: fecha,
                        anterior: turnoAnterior,
                        nuevo: turnoNuevo,
                        hotel: c.hotel
                    });
                }
            });
        });

        if (btn) btn.textContent = 'Publicando en Supabase...';

        // --- 2. PUBLICAR CAMBIOS ---
        await window.TurnosDB.bulkUpsert(flatData);

        // --- 3. GENERAR LOG DE AUDITORÍA ---
        await window.TurnosDB.insertLog({
            cambios_totales: flatData.length,
            resumen: {
                accion: 'publicar_snapshot_cuadrante',
                hoteles: Array.from(new Set(changes.map(c => c.hotel))),
                rango: {
                    inicio: changes.length > 0 ? changes[0].weekStart : (weeksAffected[0] || ''),
                    fin: changes.length > 0 ? changes[changes.length - 1].weekStart : (weeksAffected[0] || '')
                }
            },
            cambios_detalle_json: traceabilityDetails
        });

        // --- 4. GENERAR Y GUARDAR SNAPSHOTS FINALES (ARQUITECTURA FIJA v12.0) ---
        // Admin resuelve la operativa completa y guarda el resultado horneado.
        if (btn) btn.textContent = 'Horneando snapshots finales...';
        
        let weeksAffected = Array.from(new Set(changes.map(c => c.weekStart)));
        let hotelsAffected = Array.from(new Set(changes.map(c => c.hotel)));

        // Si es publicación forzada (sin cambios), usamos la semana visible
        if (weeksAffected.length === 0) {
            const rawDate = document.getElementById('datePicker')?.value;
            if (rawDate) {
                const base = new Date(rawDate + 'T12:00:00');
                weeksAffected = [window.isoDate(window.getMonday(base))];
            }
        }
        
        // Si no hay hoteles afectados específicos, publicamos todos los disponibles
        if (hotelsAffected.length === 0) {
            hotelsAffected = await window.TurnosDB.getHotels();
        }
        // V12.5 Safety Filter: No publicar nunca hoteles de test
        hotelsAffected = hotelsAffected.filter(h => h && !h.toUpperCase().startsWith('TEST'));

        const profiles = await window.TurnosDB.getEmpleados();
        
        // Intentar obtener los datos base del Excel (caché compartida o carga fresca)
        let excelSource = window._sharedExcelSourceRows;
        if (!excelSource) {
            excelSource = await window.ExcelLoader.loadExcelSourceRows().catch(() => ({}));
        }

        for (const weekStart of weeksAffected) {
            const weekEnd = window.addIsoDays(weekStart, 6);
            const [eventos, turnosSemana] = await Promise.all([
                window.TurnosDB.fetchEventos(weekStart, weekEnd),
                window.TurnosDB.fetchRango(weekStart, weekEnd)
            ]);

            for (const hName of hotelsAffected) {
                const dates = [0,1,2,3,4,5,6].map(i => window.addIsoDays(weekStart, i));
                
                // 1. TAREA CODEX: Priorizar el Cache de lo que el Admin está VIENDO en pantalla
                let snapshotObj = null;
                const cache = window._lastRenderedPreviewSnapshotSource;
                
                if (cache && cache.semana_inicio === weekStart) {
                    const hotelCache = cache.hoteles.find(h => h.hotel === hName);
                    if (hotelCache) {
                        console.log(`[SNAPSHOT] Usando cache de Vista Previa para ${hName}`);
                        snapshotObj = {
                            semana_inicio: weekStart,
                            semana_fin: weekEnd,
                            hotel: hName,
                            empleados: hotelCache.empleados
                        };
                    }
                }

                // 2. Si no hay cache, resolver (pero usando el modelo fiel)
                if (!snapshotObj) {
                    console.warn(`[SNAPSHOT] No hay cache para ${hName}. Re-resolviendo modelo...`);
                    let weekExcelRows = (excelSource[hName] || []).filter(r => r.weekStart === weekStart);
                    
                    const previewModel = window.createPuestosPreviewModel({
                        hotel: hName,
                        dates: dates,
                        sourceRows: weekExcelRows,
                        rows: turnosSemana.filter(t => t.hotel_id === hName),
                        eventos,
                        employees: profiles
                    });

                    if (previewModel.puestos.length === 0) {
                        console.warn(`[SNAPSHOT] Saltando ${hName} - No hay datos operativos.`);
                        continue;
                    }

                    const emps = previewModel.getEmployees();
                    const seen = new Set();
                    const orderedEmps = emps.filter(e => {
                        if (seen.has(e.employee_id)) return false;
                        seen.add(e.employee_id);
                        return true;
                    });

                    snapshotObj = {
                        semana_inicio: weekStart,
                        semana_fin: weekEnd,
                        hotel: hName,
                        empleados: orderedEmps.map((emp, idx) => {
                            const daysMap = {};
                            dates.forEach(fecha => {
                                const resolved = previewModel.getTurnoEmpleado(emp.employee_id, fecha);
                                const visual = window.TurnosRules ? window.TurnosRules.describeCell(resolved) : { label: resolved.turno, icons: resolved.icons || [] };
                                // B4 FIX (publicar path): mismo que en buildPublicationSnapshotPreview
                                const absCode = resolved.incidencia
                                    ? (resolved.incidencia === 'PERMISO' ? 'PERM'
                                       : resolved.incidencia === 'FORMACION' ? 'FORM'
                                       : resolved.incidencia)
                                    : null;
                                daysMap[fecha] = {
                                    label: visual.label || absCode || resolved.turno || '',
                                    code: absCode || resolved.turno || '',
                                    icons: [...new Set([...(visual.icon ? [visual.icon] : (resolved.icon ? [resolved.icon] : [])), ...((resolved.cambio || resolved.intercambio) ? ['🔄'] : [])])],
                                    type: resolved.incidencia || 'NORMAL',
                                    estado: (resolved.isAbsent || resolved.incidencia) ? 'ausente' : 'operativo',
                                    origen: resolved.incidencia || resolved.origen || 'base',
                                    changed: !!(resolved.cambio || resolved.intercambio),
                                    icon: resolved.icon || null,
                                    icons: resolved.icons || null,
                                    titular_cubierto: resolved.titular || null,
                                    sustituto: resolved.sustituidoPor || null
                                };
                            });
                            const profile = profiles.find(p => window.normalizeId(p.id) === window.normalizeId(emp.employee_id) || window.normalizeId(p.nombre) === window.normalizeId(emp.employee_id));
                            return {
                                nombre: emp.nombre || emp.employee_id,
                                nombreVisible: emp.nombreVisible || emp.displayName || emp.nombre || emp.employee_id,
                                empleado_id: emp.employee_id,
                                orden: idx + 1,
                                dias: daysMap,
                                // Enriquecimiento para detección visual en index
                                tipo: profile?.tipo || null,
                                puesto: profile?.puesto || null,
                                categoria: profile?.categoria || null,
                                notas: profile?.notas || null,
                                tags: profile?.tags || null,
                                tipo_personal: profile?.tipo_personal || null,
                                excludeCounters: window.isEmpleadoOcasionalOApoyo && window.isEmpleadoOcasionalOApoyo(profile)
                            };
                        })
                    };
                }

                // 3. Validar contenido final antes de enviar
                // No podemos validar contra previewModel si usamos cache directo, 
                // pero el cache ya se validó (o se generó) durante el render.

                // 4. Guardar snapshot
                await window.TurnosDB.publishCuadranteSnapshot({
                    semanaInicio: weekStart,
                    semanaFin: weekEnd,
                    hotel: hName,
                    snapshot: snapshotObj,
                    resumen: { emps: snapshotObj.empleados.length },
                    usuario: 'ADMIN'
                });
            }
        }

        // Actualizar base original local
        window._adminExcelBaseOriginalRows = window.cloneExcelRows(window._adminExcelEditableRows);
        window.addLog(`Publicación exitosa: ${flatData.length} turnos actualizados. Log guardado.`, 'ok');
        
        document.getElementById('publishPreviewModal')?.classList.remove('open');
        alert(`Publicación completada con éxito.\nSe han actualizado ${flatData.length} turnos.`);

        window.renderExcelView();
        window.renderPreview();
        window.renderDashboard(); // Refrescar actividad
        if (window.populateEmployees) window.populateEmployees();

    } catch (error) {
        if (error.message !== 'Validación fallida') {
            console.error('Error en publicación:', error);
            alert('Error al publicar: ' + error.message);
        }
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Reintentar Publicación';
            btn.style.opacity = '1';
        }
    }
};

window.revertirPublicacion = async (logId) => {
    if (!confirm('¿Estás seguro de revertir esta publicación? Se restaurarán los turnos anteriores registrados en el log.')) return;

    try {
        window.addLog(`Iniciando reversión de publicación ${logId}...`, 'warn');
        const log = await window.TurnosDB.getLog(logId);
        
        if (!log || !log.cambios_detalle_json || log.revertida) {
            throw new Error('El log no es válido o ya ha sido revertido.');
        }

        const revertData = log.cambios_detalle_json.map(d => ({
            empleado_id: d.empleado_id,
            fecha: d.fecha,
            turno: d.anterior,
            tipo: 'NORMAL',
            hotel_id: d.hotel,
            updated_by: `ROLLBACK_${logId.slice(0,8)}`
        }));

        await window.TurnosDB.bulkUpsert(revertData);
        await window.TurnosDB.updateLog(logId, { revertida: true, estado: 'revertido' });

        window.addLog(`Reversión completada: ${revertData.length} turnos restaurados.`, 'ok');
        alert('Publicación revertida con éxito.');
        
        window.renderDashboard();
        window.renderPreview();
    } catch (err) {
        console.error('Error al revertir:', err);
        alert('Error al revertir: ' + err.message);
    }
};

// ==========================================
// 13. REAL-TIME OPERATIONAL DASHBOARD (V2 - ACTIVE CONTROL)
// ==========================================

window.renderDashboard = async () => {
    if (!window.TurnosDB) {
        console.error('[ADMIN ERROR] DAO (TurnosDB) no inicializado. Revisa el orden de scripts y posibles errores de sintaxis.');
        return;
    }
    // Evitar ejecuciones duplicadas en ráfaga (debouncing preventivo)
    const now = Date.now();
    if (window._lastDashboardRender && (now - window._lastDashboardRender < 500)) return;
    window._lastDashboardRender = now;

    const today = window.isoDate(new Date());
    
    try {
        const [eventos, peticiones, empleados, turnosHoy] = await Promise.all([
            window.TurnosDB.fetchEventos(window.addIsoDays(today, -30), window.addIsoDays(today, 60)),
            window.TurnosDB.fetchPeticiones(),
            window.TurnosDB.getEmpleados(),
            window.TurnosDB.fetchRango(today, today)
        ]);
        console.log('EVENTOS CARGADOS', eventos.length);
        if (window.DEBUG_MODE) {
            console.log('[EVENTOS SAMPLE]', eventos.slice(0, 5));
        }

        const idMap = new Map();
        const nameToIds = new Map();
        (empleados || []).forEach(e => {
            const normId = window.normalizeId(e.id);
            const normName = window.normalizeId(e.nombre);
            idMap.set(normId, e.id);
            if (!nameToIds.has(normName)) nameToIds.set(normName, new Set());
            nameToIds.get(normName).add(e.id);
        });
        const resolveId = (raw) => {
            if (!raw) return null;
            const norm = window.normalizeId(raw);
            if (idMap.has(norm)) return idMap.get(norm);
            const ids = nameToIds.get(norm);
            return (ids && ids.size === 1) ? Array.from(ids)[0] : norm;
        };

        const conflicts = await window.detectarConflictosOperativos(today, 'TODOS', (typeof eventos !== 'undefined' ? eventos : []), resolveId);
        const changes = window.getExcelDiff ? window.getExcelDiff() : [];

        // --- BLOQUE A: ESTADO DEL SISTEMA ---
        const activeEmps = (empleados || []).filter(e => e.activo !== false && e.id !== '¿?');
        const totalEmps = activeEmps.length;
        const empsConId = activeEmps.filter(e => e.id_interno && String(e.id_interno).trim() !== '').length;
        const integrity = totalEmps > 0 ? Math.round((empsConId / totalEmps) * 100) : 100;

        if ($('#stat-cloud-status')) $('#stat-cloud-status').textContent = 'Conectado';
        if ($('#stat-last-sync')) $('#stat-last-sync').textContent = new Date().toLocaleTimeString();
        if ($('#stat-pending-diff')) $('#stat-pending-diff').textContent = changes.length;
        if ($('#stat-integrity-score')) $('#stat-integrity-score').textContent = `${integrity}%`;

        // --- BLOQUE B: RIESGO OPERATIVO (AGRUPADO) ---
        const riskContainer = $('#risk-alerts-container');
        const counts = { critical: conflicts.CRITICAL.length, warning: conflicts.WARNING.length, info: conflicts.INFO.length };
        
        const allRisks = [
            ...conflicts.CRITICAL.map(c => ({ ...c, severity: 'critical' })),
            ...conflicts.WARNING.map(c => ({ ...c, severity: 'warning' })),
            ...conflicts.INFO.map(c => ({ ...c, severity: 'info' }))
        ];

        // Auditoría de ID Interno (Fase 1)
        const empsSinIdInterno = (empleados || []).filter(e => (!e.id_interno || String(e.id_interno).trim() === '') && e.activo !== false && e.id !== '¿?');
        if (empsSinIdInterno.length > 0) {
            allRisks.push({
                severity: 'info',
                type: 'SIN_ID_INTERNO',
                empId: empsSinIdInterno[0].id || empsSinIdInterno[0].nombre,
                title: 'Mapeo de ID Interno',
                desc: `Faltan asignar ${empsSinIdInterno.length} IDs internos persistentes.`
            });
        }

        // Plaza Pendiente (¿?)
        const plazaPendiente = (empleados || []).find(e => e.id === '¿?' && e.activo !== false);
        if (plazaPendiente) {
            allRisks.push({
                severity: 'info',
                type: 'PLAZA_PENDIENTE',
                empId: '¿?',
                title: 'Plaza Pendiente de Definir',
                desc: `Existe un registro provisional (${plazaPendiente.id}) para planificación de coberturas.`
            });
        }

        if (riskContainer) {
            if (allRisks.length === 0) {
                riskContainer.innerHTML = `
                    <div class="alert-card severity-info" style="cursor: default; opacity: 0.8;">
                        <div class="alert-icon"><i class="fas fa-check-double"></i></div>
                        <div class="alert-content">
                            <div class="alert-title">Operación Estable</div>
                            <div class="alert-desc">No se han detectado conflictos operativos ni riesgos en el sistema.</div>
                        </div>
                    </div>
                `;
            } else {
                riskContainer.innerHTML = allRisks.map(r => `
                    <div class="alert-card severity-${r.severity}">
                        <div class="alert-icon"><i class="fas ${r.type === 'SIN_ID' ? 'fa-id-card' : (r.type === 'JORNADA' ? 'fa-tired' : 'fa-exclamation-triangle')}"></i></div>
                        <div class="alert-content">
                            <div class="alert-title">${escapeHtml(r.title)}</div>
                            <div class="alert-desc">${escapeHtml(r.desc)}</div>
                        </div>
                        <div class="alert-actions">
                            <button class="alert-btn primary" onclick="${r.action ? r.action.fn : (r.empId ? `window.goToOperationalIssue('${r.empId}', '${r.fecha || ''}', '${r.type || ''}')` : `window.switchSection('preview')`)}">
                                ${r.action ? r.action.label : 'Ver Detalle'}
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Badges y KPIs nuevos
        if ($('#count-critical')) $('#count-critical').textContent = `${counts.critical} Críticos`;
        if ($('#count-warning')) $('#count-warning').textContent = `${counts.warning} Avisos`;
        if ($('#count-info')) $('#count-info').textContent = `${counts.info} Info`;

        if ($('#stat-critical-count')) {
            $('#stat-critical-count').textContent = counts.critical;
            $('#stat-critical-count').style.color = counts.critical > 0 ? '#ef4444' : '#10b981';
        }
        if ($('#stat-pending-requests')) {
            const pendingReqs = (peticiones || []).filter(p => p.estado === 'pendiente' || p.estado === 'PENDIENTE').length;
            $('#stat-pending-requests').textContent = pendingReqs;
            $('#stat-pending-requests').style.color = pendingReqs > 0 ? '#f59e0b' : 'inherit';
        }

        // --- BLOQUE E: ACCIONES RÁPIDAS ---
        const quickActions = $('#dashboard-quick-actions');
        if (quickActions) {
            quickActions.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:15px;">
                    <button class="btn-premium" onclick="window.switchSection('excel')" style="height:100px; flex-direction:column; gap:8px; border-radius:16px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px; height:28px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        <span style="font-size:0.8rem; font-weight:800;">Gestión Excel</span>
                    </button>
                    <button class="btn-premium" onclick="window.switchSection('preview')" style="height:100px; flex-direction:column; gap:8px; border-radius:16px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px; height:28px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span style="font-size:0.8rem; font-weight:800;">Vista Previa</span>
                    </button>
                    <button class="btn-premium" onclick="window.switchSection('employees')" style="height:100px; flex-direction:column; gap:8px; border-radius:16px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px; height:28px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        <span style="font-size:0.8rem; font-weight:800;">Empleados</span>
                    </button>
                    <button class="btn-premium" onclick="window.open('https://cumbriaspahotel.github.io/Turnos-new/', '_blank')" style="height:100px; flex-direction:column; gap:8px; background:var(--accent); color:white; border-radius:16px; border:none;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:28px; height:28px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        <span style="font-size:0.8rem; font-weight:800;">Vista Pública</span>
                    </button>
                </div>
            `;
        }

        // --- BLOQUE D: ACTIVIDAD / AUDITORÍA ---
        const timeline = $('#dashboard-timeline');
        if (timeline) {
            try {
                const logs = await window.TurnosDB.fetchLogs(20);
                
                // Calcular actividad hoy
                const todayISO = new Date().toISOString().split('T')[0];
                const todayLogs = (logs || []).filter(l => l.fecha && l.fecha.startsWith(todayISO)).length;
                // Bajas activas: count events whose period covers today (not finalized/past)
                try {
                    const evts = await window.TurnosDB.fetchEventos();
                    const bajaTipos = ['BAJA','PERM','PERMISO','IT','BAJA_MEDICA','FORMACION','AUSENCIA','OTRO'];
                    const activeBajas = (evts || []).filter(e => {
                        if (!bajaTipos.includes((e.tipo || '').toUpperCase())) return false;
                        const est = (e.estado || 'activo').toLowerCase();
                        if (est === 'anulado' || est === 'rechazado') return false;
                        const fin = e.fecha_fin || e.fecha_inicio;
                        return e.fecha_inicio <= todayISO && fin >= todayISO;
                    }).length;
                    if ($('#stat-today-activity')) $('#stat-today-activity').textContent = activeBajas;
                } catch(be) { console.warn('[Dashboard] Error counting bajas:', be); }

                if (!logs || logs.length === 0) {
                    timeline.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.5; font-size:0.9rem;"><i class="fas fa-history fa-2x" style="display:block; margin-bottom:12px;"></i>Sin actividad reciente.</div>';
                } else {
                    timeline.innerHTML = logs.map(log => `
                        <div class="activity-log-item ${log.revertida ? 'warn' : 'ok'}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; align-items: center; gap: 16px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${log.revertida ? '#fee2e2' : '#f0fdf4'}; display: flex; align-items: center; justify-content: center; color: ${log.revertida ? '#ef4444' : '#10b981'};">
                                    <i class="fas ${log.revertida ? 'fa-undo' : 'fa-check'}"></i>
                                </div>
                                <div>
                                    <div style="font-weight: 800; color: #334155; font-size: 0.9rem;">${log.revertida ? 'Publicación Revertida' : 'Sincronización Cloud'}</div>
                                    <div style="font-size: 0.75rem; color: #64748b;">${log.cambios_totales} turnos • por ${log.usuario || 'Admin'} • ID: ${log.id.slice(0,8)}</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.75rem; font-weight: 700; color: #94a3b8;">${new Date(log.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                ${log.revertida ? '<span style="font-size: 0.65rem; color: #ef4444; font-weight: 700;">REVERTIDA</span>' : `<button class="btn-text" style="font-size: 0.65rem; color: #ef4444; font-weight: 700; text-decoration: underline;" onclick="window.revertirPublicacion('${log.id}')">REVERTIR</button>`}
                            </div>
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error('[AUDITORIA ERROR]', err);
                timeline.innerHTML = '<div style="padding:40px; text-align:center; color:var(--error); font-size:0.8rem;">Auditoría no disponible.</div>';
            }
        }

        // --- 4. ESTADO DE SINCRONIZACI�N ---
        const syncStatus = window.TurnosDB._channel?.status || (window.realtimeActivo ? 'ok' : 'connecting');
        if ($('#sync-cloud-status')) {
            $('#sync-cloud-status').textContent = (syncStatus === 'ok' || syncStatus === 'SUBSCRIBED') ? 'ACTIVO' : 'RECONECTANDO';
            $('#sync-cloud-status').style.color = (syncStatus === 'ok' || syncStatus === 'SUBSCRIBED') ? '#10b981' : '#f59e0b';
        }
        if ($('#sync-last-time')) $('#sync-last-time').textContent = new Date().toLocaleTimeString();
        if ($('#sync-pending-changes')) {
            const diff = window.getExcelDiff ? window.getExcelDiff().length : 0;
            $('#sync-pending-changes').textContent = diff;
            $('#sync-pending-changes').style.color = diff > 0 ? '#ef4444' : 'inherit';
        }

    } catch (err) {
        console.error('[ADMIN ERROR] Dashboard Render Failure', {
            message: err.message,
            stack: err.stack,
            context: 'renderDashboard',
            timestamp: new Date().toISOString()
        });
    }
};

// --- REACTIVIDAD REAL-TIME ---
window.aplicarCambioLocal = (payload) => {
    // console.log("Realtime Payload:", payload);
    // Solo refrescar dashboard si está visible para no saturar
    if ($('#section-home').classList.contains('active')) {
        if (window._dashRefreshTimer) clearTimeout(window._dashRefreshTimer);
        window._dashRefreshTimer = setTimeout(window.renderDashboard, 1000);
    window.initPreviewPickers();
    }
    if ($('#section-changes').classList.contains('active')) {
        if (window._changesRefreshTimer) clearTimeout(window._changesRefreshTimer);
        window._changesRefreshTimer = setTimeout(window.renderChanges, 1000);
    }
    if ($('#section-vacations').classList.contains('active')) {
        if (window._vacRefreshTimer) clearTimeout(window._vacRefreshTimer);
        window._vacRefreshTimer = setTimeout(window.renderVacations, 1000);
    }
    if ($('#section-bajas').classList.contains('active')) {
        if (window._bajasRefreshTimer) clearTimeout(window._bajasRefreshTimer);
        window._bajasRefreshTimer = setTimeout(window.renderBajas, 1000);
    }
};

// Hook into navigation
// Reactive hooks integrated in individual modules.

// --- BADGES Y NOTIFICACIONES ---
window.updateSidebarBadges = async () => {
    try {
        const peticiones = await window.TurnosDB.fetchPeticiones();
        const pending = peticiones.filter(p => p.estado === 'pendiente').length;
        const badge = $('#badge-requests');
        if (badge) {
            badge.textContent = pending;
            badge.style.display = pending > 0 ? 'flex' : 'none';
        }
    } catch (e) {
        console.warn("Error actualizando badges:", e);
    }
};

// ==========================================
// 10. HELPERS Y GESTIÓN DE PERFIL DE EMPLEADO
// ==========================================

window.escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

window.renderEmployeeProfileField = ([label, value]) => {
    return `
        <div class="emp-ficha-field">
            <label>${label}</label>
            <div class="emp-ficha-field-value">${value || 'No definido'}</div>
        </div>
    `;
};

window.employeeProfileTypeMeta = (tipo) => {
    const key = window.employeeNorm(tipo);
    if (key.includes('placeholder') || key.includes('vacante')) return { label: 'Placeholder', cls: 'placeholder' };
    if (key.includes('baja_empresa') || key.includes('inactivo')) return { label: 'Baja empresa', cls: 'baja_empresa' };
    if (key.includes('temporada')) return { label: 'Temporada', cls: 'temporada' };
    if (key.includes('apoyo')) return { label: 'Apoyo', cls: 'apoyo' };
    if (key.includes('ocasional')) return { label: 'Ocasional', cls: 'ocasional' };
    return { label: 'Fijo', cls: 'fijo' };
};

window.employeeProfileRoleMeta = (rol) => {
    const key = window.employeeNorm(rol);
    if (key.includes('refuerzo')) return { label: 'Refuerzo', cls: 'refuerzo' };
    if (key.includes('sust')) return { label: 'Sustituto', cls: 'sustituto' };
    if (key.includes('aus')) return { label: 'Ausente', cls: 'ausente' };
    if (key.includes('cambio')) return { label: 'Cambio', cls: 'cambio' };
    return { label: 'Titular', cls: 'titular' };
};

window.employeeRoleOptionsHTML = (selectedRole = 'titular') => {
    const selected = window.employeeConfiguredRole ? window.employeeConfiguredRole({ rol_operativo: selectedRole }) : 'titular';
    return [
        ['titular', 'Titular'],
        ['sustituto', 'Sustituto'],
        ['refuerzo', 'Refuerzo']
    ].map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
};

window.employeeProfileLaborStatusMeta = (profile) => {
    const structural = window.getEmployeeStructuralType ? window.getEmployeeStructuralType(profile) : 'fijo';
    const inactive = profile?.activo === false || window.employeeNorm(profile?.estado_empresa || profile?.estado).includes('baja');
    if (structural === 'placeholder') return { label: 'Vacante operativa', cls: 'placeholder' };
    if (structural === 'baja_empresa' || inactive) return { label: 'Inactivo', cls: 'inactivo' };
    return { label: 'Activa', cls: 'activa' };
};

window.isExplicitRefuerzoEvent = (ev) => Boolean(
    ev?.isRefuerzo === true ||
    window.employeeNorm(ev?.origen) === 'refuerzo' ||
    window.employeeNorm(ev?.payload?.tipo_modulo) === 'refuerzo' ||
    window.employeeNorm(ev?.payload?.creado_desde) === 'admin_refuerzo' ||
    ev?.meta?.refuerzo === true ||
    /REFUERZO|COBERTURA_EXTRA/i.test(String(ev?.tipo || ''))
);

window.getEmployeeIdentityKeys = (profile) => new Set([
    window.normalizeId(profile?.uuid),
    window.normalizeId(profile?.id),
    window.normalizeId(profile?.id_interno),
    window.normalizeId(profile?.legacy_id),
    window.normalizeId(profile?.nombre)
].filter(Boolean));

window.eventHasEmployeeIdentity = (ev, identityKeys) => {
    const keys = [
        ev?.empleado_uuid,
        ev?.empleado_id,
        ev?.id_interno,
        ev?.legacy_id,
        ev?.payload?.empleado_uuid,
        ev?.payload?.empleado_id,
        ev?.payload?.empleado,
        ev?.payload?.empleado_nombre
    ].map(v => window.normalizeId(v)).filter(Boolean);
    return keys.some(key => identityKeys.has(key));
};

window.resolveEmployeeCanonicalId = (rawId, employees = window.empleadosGlobales || []) => {
    if (!rawId) return rawId;
    const norm = window.normalizeId || ((value) => String(value || '').trim().toLowerCase());
    const rawKey = norm(rawId);
    const found = (employees || []).find(emp => [
        emp?.id,
        emp?.nombre,
        emp?.id_interno,
        emp?.uuid,
        emp?.legacy_id
    ].map(norm).filter(Boolean).includes(rawKey));
    return found ? found.id : rawId;
};

window.eventAffectsEmployeeProfile = (ev, profile, identityKeys = window.getEmployeeIdentityKeys(profile)) => {
    if (!ev || !profile) return false;
    if (window.eventHasEmployeeIdentity(ev, identityKeys) || window.eventHasDestinationIdentity(ev, identityKeys)) return true;
    if (window.eventoPerteneceAEmpleado && window.eventoPerteneceAEmpleado(ev, profile.id)) return true;
    const canonicalEmployee = window.resolveEmployeeCanonicalId(ev.empleado_id, window.empleadosGlobales || []);
    const canonicalDestination = window.resolveEmployeeCanonicalId(ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto, window.empleadosGlobales || []);
    return [canonicalEmployee, canonicalDestination].map(window.normalizeId).some(key => identityKeys.has(key));
};

window.employeeProfileVacationPeriods = (events, profile, year) => {
    const employees = window.empleadosGlobales || [];
    const identityKeys = window.getEmployeeIdentityKeys(profile);
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const isExcluded = (estado) => /^(anulad|rechazad|cancelad)/i.test(String(estado || ''));
    const isVac = (ev) => {
        const tipo = window.normalizeTipo ? window.normalizeTipo(ev?.tipo) : String(ev?.tipo || '').toUpperCase();
        return tipo === 'VAC' || tipo.startsWith('VAC');
    };
    const sourceBelongs = (ev) => {
        const canonical = window.resolveEmployeeCanonicalId(ev?.empleado_id || ev?.payload?.empleado_id || ev?.payload?.empleado, employees);
        return identityKeys.has(window.normalizeId(canonical));
    };
    const vacEvents = (events || [])
        .filter(ev => isVac(ev) && !isExcluded(ev.estado))
        .filter(ev => {
            const start = String(ev.fecha_inicio || '').slice(0, 10);
            const end = String(ev.fecha_fin || start).slice(0, 10);
            return start && end && start <= yearEnd && end >= yearStart;
        })
        .filter(sourceBelongs)
        .map(ev => ({
            ...ev,
            empleado_id: window.resolveEmployeeCanonicalId(ev.empleado_id, employees),
            empleado_destino_id: window.resolveEmployeeCanonicalId(ev.empleado_destino_id || ev.payload?.sustituto, employees)
        }));

    const grouped = window.groupConsecutiveEvents ? window.groupConsecutiveEvents(vacEvents) : vacEvents;
    const merged = [];
    grouped.forEach(g => {
        const start = String(g.fecha_inicio || '').slice(0, 10);
        const end = String(g.fecha_fin || start).slice(0, 10);
        if (!start) return;
        const empId = window.resolveEmployeeCanonicalId(g.empleado_id, employees);
        const hotel = g.hotel_origen || g.payload?.hotel_id || '';
        const tipo = (g.tipo || 'VAC').split(' ')[0];
        const existing = merged.find(m =>
            m.empleado_id === empId &&
            (m.hotel_origen || '') === hotel &&
            (m.tipo || '') === tipo &&
            (m.fecha_inicio <= end && (m.fecha_fin || m.fecha_inicio) >= start ||
             Math.abs(new Date(`${start}T12:00:00`) - new Date(`${m.fecha_fin || m.fecha_inicio}T12:00:00`)) <= 86400000)
        );
        if (existing) {
            if (start < existing.fecha_inicio) existing.fecha_inicio = start;
            if (end > (existing.fecha_fin || existing.fecha_inicio)) existing.fecha_fin = end;
            existing.ids = [...(existing.ids || [existing.id]), ...(g.ids || [g.id])].filter(Boolean);
            existing.isGroup = true;
            if (!existing.empleado_destino_id && g.empleado_destino_id) existing.empleado_destino_id = g.empleado_destino_id;
        } else {
            merged.push({
                ...g,
                empleado_id: empId,
                hotel_origen: hotel,
                tipo,
                fecha_inicio: start,
                fecha_fin: end,
                ids: g.ids || [g.id].filter(Boolean),
                isGroup: Boolean(g.isGroup)
            });
        }
    });
    return merged.sort((a, b) => String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || '')));
};

window.eventHasDestinationIdentity = (ev, identityKeys) => {
    const keys = [
        ev?.empleado_destino_uuid,
        ev?.empleado_destino_id,
        ev?.sustituto_id,
        ev?.sustituto,
        ev?.payload?.empleado_destino_uuid,
        ev?.payload?.empleado_destino_id,
        ev?.payload?.sustituto_id,
        ev?.payload?.sustituto,
        ev?.payload?.sustituto_nombre
    ].map(v => window.normalizeId(v)).filter(Boolean);
    return keys.some(key => identityKeys.has(key));
};

window.employeeProfileEventLabel = (ev) => {
    const tipo = window.normalizeTipo ? window.normalizeTipo(ev?.tipo) : window.employeeNorm(ev?.tipo).toUpperCase();
    if (tipo === 'VAC') return 'Vacaciones';
    if (tipo === 'BAJA' || tipo === 'IT') return 'Baja / IT';
    if (tipo === 'PERM' || tipo === 'PERMISO') return 'Permiso';
    if (tipo === 'CAMBIO_TURNO' || tipo === 'CAMBIO') return 'Cambio de turno';
    if (tipo === 'INTERCAMBIO_TURNO' || tipo === 'INTERCAMBIO') return 'Intercambio';
    if (/REFUERZO/.test(tipo)) return 'Refuerzo';
    if (/COBERTURA/.test(tipo)) return 'Cobertura';
    return String(ev?.tipo || 'Evento');
};

window.employeeProfileReadableSource = (ev) => {
    return ev?.payload?.creado_desde || ev?.origen || ev?.payload?.tipo_modulo || 'manual';
};

window.employeeProfileActorLabel = (ev) => {
    const titular = ev?.empleado_id || ev?.payload?.empleado_id || '';
    const destino = ev?.empleado_destino_id || ev?.sustituto_id || ev?.sustituto || ev?.payload?.empleado_destino_id || ev?.payload?.sustituto_id || ev?.payload?.sustituto || '';
    const solicitante = ev?.payload?.solicitante || ev?.payload?.solicitado_por || ev?.payload?.creado_por || ev?.created_by || '';
    const companero = ev?.payload?.companero || ev?.payload?.compañero || ev?.payload?.destinatario || '';
    if (/CAMBIO|INTERCAMBIO/i.test(String(ev?.tipo || ''))) {
        if (solicitante || companero) return `Solicita ${solicitante || titular || 'N/D'}${companero ? ` con ${companero}` : ''}`;
        if (titular && destino) return `${titular} ↔ ${destino}`;
    }
    if ((/VAC|BAJA|PERM|IT|COBERTURA|SUSTITUCION/i.test(String(ev?.tipo || ''))) && titular && destino) {
        return `${destino} cubre a ${titular}`;
    }
    if (titular) return titular;
    return 'Sin actor claro';
};

window.employeeProfileDateRangeLabel = (start, end) => {
    if (!start) return 'No informado';
    if (!end || end === start) return window.fmtDateLegacy(start);
    return `${window.fmtDateLegacy(start)} — ${window.fmtDateLegacy(end)}`;
};

window.employeeProfileShiftCodeMeta = (value) => {
    const raw = String(value || '').trim();
    const code = window.normalizePreviewTurno ? window.normalizePreviewTurno(raw) : raw.toUpperCase();
    if (code === 'M') return { code: 'M', cls: 'm', label: 'Mañana' };
    if (code === 'T') return { code: 'T', cls: 't', label: 'Tarde' };
    if (code === 'N') return { code: 'N', cls: 'n', label: 'Noche' };
    if (code === 'D') return { code: 'D', cls: 'd', label: 'Descanso' };
    if (code.startsWith('VAC')) return { code: 'VAC', cls: 'v', label: 'Vacaciones' };
    if (code.startsWith('BAJA') || code.startsWith('IT') || code.startsWith('PERM')) return { code: 'BAJA', cls: 'b', label: 'Baja / Permiso' };
    return { code: raw || '—', cls: 'x', label: raw || '—' };
};

window.loadEmployeeProfileBaseRows = async (empId, refISO) => {
    if (!window.TurnosDB?.fetchTurnosBase) return [];
    const profile = (window.empleadosGlobales || []).find(e =>
        window.normalizeId(e.id) === window.normalizeId(empId) ||
        window.normalizeId(e.nombre) === window.normalizeId(empId)
    );
    if (!profile) return [];

    const hotel = profile.hotel_id || profile.hotel || null;
    const refDate = new Date(`${refISO}T12:00:00`);
    const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const last = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    const start = new Date(first);
    const end = new Date(last);
    while (start.getDay() !== 1) start.setDate(start.getDate() - 1);
    while (end.getDay() !== 0) end.setDate(end.getDate() + 1);

    let rows = await window.TurnosDB.fetchTurnosBase(window.isoDate(start), window.isoDate(end), hotel);
    if ((!Array.isArray(rows) || rows.length === 0) && hotel) {
        rows = await window.TurnosDB.fetchTurnosBase(window.isoDate(start), window.isoDate(end), null);
    }
    window._employeeProfileBaseRows = Array.isArray(rows) ? rows : [];
    return window._employeeProfileBaseRows;
};

window.buildEmployeeProfileModel = (empId, refISO) => {
    const profile = (window.empleadosGlobales || []).find(e =>
        window.normalizeId(e.id) === window.normalizeId(empId) ||
        window.normalizeId(e.nombre) === window.normalizeId(empId)
    );
    if (!profile) return null;

    const hotelPrincipal = profile.hotel_id || profile.hotel || '';
    const identityKeys = window.getEmployeeIdentityKeys(profile);
    const emp = {
        ...profile,
        hotel: hotelPrincipal,
        hotel_id: hotelPrincipal,
        tipo: profile.tipo || profile.tipo_personal || profile.contrato || ''
    };

    const refDate = new Date(`${refISO}T12:00:00`);
    const startMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const eventos = window.eventosActivos || window.eventosGlobales || [];
    let baseIndex = null;
    const employeeKeys = new Set([
        window.normalizeId(profile.id),
        window.normalizeId(profile.nombre),
        window.normalizeId(profile.id_interno)
    ].filter(Boolean));

    if (Array.isArray(window._employeeProfileBaseRows) && window._employeeProfileBaseRows.length > 0 && window.buildIndices) {
        const baseRowsFlat = window._employeeProfileBaseRows
            .filter(row => {
                const rowKeys = [
                    window.normalizeId(row.empleado_id),
                    window.normalizeId(row.empleadoId),
                    window.normalizeId(row.nombre),
                    window.normalizeId(row.displayName)
                ].filter(Boolean);
                return rowKeys.some(key => employeeKeys.has(key));
            })
            .map(row => ({
                empleadoId: row.empleado_id || row.empleadoId || profile.id,
                fecha: row.fecha,
                turno: row.turno || null
            }));
        if (baseRowsFlat.length > 0) {
            baseIndex = window.buildIndices(window.empleadosGlobales || [], [], baseRowsFlat).baseIndex;
        }
    }

    if (!baseIndex) {
        baseIndex = window._lastBaseIndex || window._baseIndex || null;
    }

    if (!baseIndex) {
        try {
            const excelSource = window._adminExcelEditableRows || window._adminExcelBaseOriginalRows || null;
            if (excelSource && window.buildIndices) {
                const baseRowsFlat = [];
                Object.values(excelSource).flat().forEach(sRow => {
                    const rowKeys = [
                        window.normalizeId(sRow.empleadoId),
                        window.normalizeId(sRow.displayName),
                        window.normalizeId(sRow.nombre),
                        window.normalizeId(sRow.id_interno)
                    ].filter(Boolean);
                    if (!rowKeys.some(key => employeeKeys.has(key))) return;
                    const fechasSemana = window.getFechasSemana ? window.getFechasSemana(sRow.weekStart || sRow.week_start) : [];
                    (sRow.values || sRow.turnos || []).forEach((turno, idx) => {
                        const fecha = fechasSemana[idx];
                        if (fecha) baseRowsFlat.push({ empleadoId: sRow.empleadoId || sRow.displayName || profile.id, fecha, turno: turno || null });
                    });
                });
                if (baseRowsFlat.length > 0) {
                    baseIndex = window.buildIndices(window.empleadosGlobales || [], [], baseRowsFlat).baseIndex;
                }
            }
            if (!baseIndex && Array.isArray(window._lastRawTurnosBase) && window._lastRawTurnosBase.length > 0 && window.buildIndices) {
                const baseRowsFlat = window._lastRawTurnosBase
                    .filter(row => {
                        const rowKeys = [
                            window.normalizeId(row.empleado_id),
                            window.normalizeId(row.empleadoId),
                            window.normalizeId(row.nombre),
                            window.normalizeId(row.displayName)
                        ].filter(Boolean);
                        return rowKeys.some(key => employeeKeys.has(key));
                    })
                    .map(row => ({
                        empleadoId: row.empleado_id || row.empleadoId || profile.id,
                        fecha: row.fecha,
                        turno: row.turno || null
                    }));
                if (baseRowsFlat.length > 0) {
                    baseIndex = window.buildIndices(window.empleadosGlobales || [], [], baseRowsFlat).baseIndex;
                }
            }
        } catch (e) {
            console.warn('[EMP PROFILE BASEINDEX]', e);
        }
    }

    const resolveId = window.normalizeId || ((raw) => String(raw || '').trim());
    const calendario = [];
    let curr = new Date(startMonth);
    while (curr.getDay() !== 1) curr.setDate(curr.getDate() - 1);

    for (let i = 0; i < 42; i++) {
        const iso = window.isoDate(curr);
        const res = window.resolveEmployeeDay({
            empleado: profile,
            empleadoId: emp.id,
            hotel: hotelPrincipal,
            fecha: iso,
            eventos,
            baseIndex,
            allEvents: eventos,
            resolveId: resolveId
        });
        calendario.push({
            fecha: iso,
            ...res,
            detalle: res,
            outsideMonth: curr.getMonth() !== refDate.getMonth()
        });
        curr.setDate(curr.getDate() + 1);
        if (i >= 34 && curr.getMonth() !== refDate.getMonth() && curr.getDay() === 1) break;
    }

    const eventosActivos = eventos.filter(ev => {
        const belongs = window.eventoPerteneceAEmpleado ? window.eventoPerteneceAEmpleado(ev, emp.id) : (ev.empleado_id === emp.id || ev.empleado_uuid === emp.uuid);
        const state = window.normalizeEstado ? window.normalizeEstado(ev.estado) : String(ev.estado || 'activo').toLowerCase();
        return belongs && state !== 'anulado';
    });
    const todayISO = window.isoDate(new Date());
    const groupedEvents = window.groupConsecutiveEvents ? window.groupConsecutiveEvents(eventosActivos) : eventosActivos;
    const yearStartISO = `${refDate.getFullYear()}-01-01`;
    const yearEndISO = `${refDate.getFullYear()}-12-31`;
    const monthStartISO = window.isoDate(new Date(refDate.getFullYear(), refDate.getMonth(), 1));
    const monthEndISO = window.isoDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0));
    const yearGroupedEvents = groupedEvents.filter(ev => {
        const start = String(ev.fecha_inicio || '').slice(0, 10);
        const end = String(ev.fecha_fin || start || '').slice(0, 10);
        return start && end && start <= yearEndISO && end >= yearStartISO;
    });
    const periodGroupedEvents = groupedEvents.filter(ev => {
        const start = String(ev.fecha_inicio || '').slice(0, 10);
        const end = String(ev.fecha_fin || start || '').slice(0, 10);
        return start && end && start <= monthEndISO && end >= monthStartISO;
    });
    const isVacationEvent = (ev) => window.normalizeTipo ? window.normalizeTipo(ev.tipo) === 'VAC' : String(ev.tipo || '').toUpperCase().includes('VAC');
    const dedupeVacationPeriods = (items) => {
        const byPeriod = new Map();
        (items || []).forEach(ev => {
            const start = String(ev.fecha_inicio || '').slice(0, 10);
            const end = String(ev.fecha_fin || ev.fecha_inicio || '').slice(0, 10);
            if (!start) return;
            const key = `${start}|${end}|${window.normalizeTipo ? window.normalizeTipo(ev.tipo) : String(ev.tipo || '').toUpperCase()}|${ev.estado || 'activo'}`;
            const current = byPeriod.get(key);
            const currentWeight = (current?.isGroup ? 1000 : 0) + (Array.isArray(current?.ids) ? current.ids.length : 1);
            const nextWeight = (ev?.isGroup ? 1000 : 0) + (Array.isArray(ev?.ids) ? ev.ids.length : 1);
            if (!current || nextWeight > currentWeight) byPeriod.set(key, ev);
        });
        return Array.from(byPeriod.values());
    };
    const yearGroupedVacs = dedupeVacationPeriods(yearGroupedEvents.filter(isVacationEvent));
    const groupedVacs = dedupeVacationPeriods(periodGroupedEvents.filter(isVacationEvent));
    const isLeavePermissionEvent = (ev) => {
        const tipo = window.normalizeTipo ? window.normalizeTipo(ev.tipo) : String(ev.tipo || '').toUpperCase();
        return ['BAJA', 'IT', 'PERM', 'PERMISO', 'FORMACION'].includes(tipo);
    };
    const availableYears = Array.from(new Set([
        new Date().getFullYear() - 1,
        new Date().getFullYear(),
        new Date().getFullYear() + 1,
        refDate.getFullYear(),
        ...groupedEvents.flatMap(ev => {
            const startYear = Number(String(ev.fecha_inicio || '').slice(0, 4));
            const endYear = Number(String(ev.fecha_fin || ev.fecha_inicio || '').slice(0, 4));
            return [startYear, endYear].filter(Number.isFinite);
        })
    ])).sort((a, b) => a - b);
    const usadas = groupedVacs
        .filter(ev => (ev.fecha_inicio || '') < todayISO)
        .reduce((acc, ev) => {
            const endUsed = (ev.fecha_fin || ev.fecha_inicio) >= todayISO ? window.addIsoDays(todayISO, -1) : (ev.fecha_fin || ev.fecha_inicio);
            if (!endUsed || endUsed < ev.fecha_inicio) return acc;
            const s = new Date(`${ev.fecha_inicio}T12:00:00`);
            const e = new Date(`${endUsed}T12:00:00`);
            return acc + Math.max(0, Math.round((e - s) / 86400000) + 1);
        }, 0);
    const previstas = groupedVacs
        .reduce((acc, ev) => {
            const startVac = ev.fecha_inicio < todayISO ? todayISO : ev.fecha_inicio;
            const s = new Date(`${startVac}T12:00:00`);
            const e = new Date(`${(ev.fecha_fin || ev.fecha_inicio)}T12:00:00`);
            return acc + Math.max(0, Math.round((e - s) / 86400000) + 1);
        }, 0);

    const ajuste = Number(emp.ajuste_vacaciones_dias || 0);
    const derechoAnual = Number(emp.vacaciones_anuales || 44);
    const saldoNeto = derechoAnual - usadas + ajuste;
    const hoy = calendario.find(d => d.fecha === todayISO) || calendario[0] || null;
    const hotelActual = hoy?.detalle?.hotel || hoy?.hotel || hotelPrincipal || '-';
    const condiciones = window.calcularCondicionesEmpleado ? window.calcularCondicionesEmpleado(emp.id) : null;
    const descansos = condiciones?.descansos || { esperados: 0, reales: 0, diferencia: 0 };
    const structuralType = window.getEmployeeStructuralType ? window.getEmployeeStructuralType(profile) : (profile.tipo || 'fijo');
    const isReducedSupport = ['apoyo', 'ocasional'].includes(structuralType);
    const typeMeta = window.employeeProfileTypeMeta(structuralType);
    const laborStatus = window.employeeProfileLaborStatusMeta(profile);
    const monthDays = calendario.filter(d => !d.outsideMonth);
    const activeTodayEvents = eventosActivos.filter(ev => {
        const start = String(ev.fecha_inicio || '').slice(0, 10);
        const end = String(ev.fecha_fin || start || '').slice(0, 10);
        return start && start <= todayISO && todayISO <= end;
    });
    const explicitRefuerzoEvents = periodGroupedEvents.filter(ev => window.isExplicitRefuerzoEvent(ev));
    const substitutionsReceived = periodGroupedEvents.filter(ev => {
        const tipo = String(ev.tipo || '').toUpperCase();
        return (['VAC', 'BAJA', 'IT', 'PERM', 'PERMISO', 'FORMACION'].includes(window.normalizeTipo ? window.normalizeTipo(ev.tipo) : tipo) || /SUSTITUCION|COBERTURA/i.test(tipo))
            && window.eventHasEmployeeIdentity(ev, identityKeys)
            && (ev.empleado_destino_id || ev.sustituto_id || ev.payload?.sustituto_id || ev.payload?.sustituto);
    });
    const substitutionsDone = periodGroupedEvents.filter(ev => {
        const tipo = String(ev.tipo || '').toUpperCase();
        return (['VAC', 'BAJA', 'IT', 'PERM', 'PERMISO', 'FORMACION'].includes(window.normalizeTipo ? window.normalizeTipo(ev.tipo) : tipo) || /SUSTITUCION|COBERTURA/i.test(tipo))
            && window.eventHasDestinationIdentity(ev, identityKeys);
    });
    const leavePermissionEvents = periodGroupedEvents.filter(isLeavePermissionEvent);
    const yearLeavePermissionEvents = yearGroupedEvents.filter(isLeavePermissionEvent);
    const cambioEvents = periodGroupedEvents.filter(ev => /CAMBIO|INTERCAMBIO/.test(String(ev.tipo || '').toUpperCase()));
    const configuredRole = window.employeeConfiguredRole ? window.employeeConfiguredRole(profile) : 'titular';
    const roleToday = activeTodayEvents.some(ev => window.isExplicitRefuerzoEvent(ev))
        ? 'refuerzo'
        : substitutionsDone.some(ev => {
            const start = String(ev.fecha_inicio || '').slice(0, 10);
            const end = String(ev.fecha_fin || start || '').slice(0, 10);
            return start <= todayISO && todayISO <= end;
        })
            ? 'sustituto'
            : activeTodayEvents.some(ev => /VAC|BAJA|IT|PERM/i.test(String(ev.tipo || '')))
                ? 'ausente'
                : configuredRole;
    const activeIncident = activeTodayEvents.find(ev => /VAC|BAJA|IT|PERM|REFUERZO|SUSTITUCION|COBERTURA|CAMBIO|INTERCAMBIO/i.test(String(ev.tipo || ''))) || null;
    const futureWorkingDays = monthDays.filter(day => day.fecha > todayISO && ['M', 'T', 'N'].includes(window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code));
    const nextShiftDay = futureWorkingDays[0] || null;
    const futureAssignedDays = monthDays.filter(day => day.fecha > todayISO && window.employeeProfileShiftCodeMeta(day.turnoBase || day.detalle?.turnoBase).code !== '—');
    const turnosBase = monthDays.filter(day => ['M', 'T', 'N', 'D'].includes(window.employeeProfileShiftCodeMeta(day.turnoBase || day.detalle?.turnoBase).code));
    const workedDays = monthDays.filter(day => ['M', 'T', 'N'].includes(window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code));
    const morningDays = workedDays.filter(day => window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code === 'M').length;
    const tardeDays = workedDays.filter(day => window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code === 'T').length;
    const nightDays = workedDays.filter(day => window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code === 'N').length;
    const restDays = monthDays.filter(day => window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code === 'D').length;
    const vacDays = monthDays.filter(day => window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code === 'VAC').length;
    const bajaPermDays = monthDays.filter(day => window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code === 'BAJA').length;
    const changeDays = monthDays.filter(day => day.cambio).length;
    const unresolvedBaseDays = monthDays.filter(day => {
        const baseCode = window.employeeProfileShiftCodeMeta(day.turnoBase || day.detalle?.turnoBase).code;
        const finalCode = window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno).code;
        return ['M', 'T', 'N', 'D'].includes(baseCode) && finalCode === '—';
    }).length;
    const rawTypeField = profile.tipo_personal || profile.tipo || profile.contrato || profile.tipo_trabajador || '';
    const annualVacPlanned = yearGroupedVacs.reduce((acc, ev) => {
        const s = new Date(`${ev.fecha_inicio}T12:00:00`);
        const e = new Date(`${(ev.fecha_fin || ev.fecha_inicio)}T12:00:00`);
        return acc + Math.max(0, Math.round((e - s) / 86400000) + 1);
    }, 0);
    const annualChanges = yearGroupedEvents.filter(ev => /CAMBIO|INTERCAMBIO/.test(String(ev.tipo || '').toUpperCase())).length;
    const annualRefuerzos = yearGroupedEvents.filter(ev => window.isExplicitRefuerzoEvent(ev)).length;
    const annualBajas = yearGroupedEvents.filter(ev => /BAJA|IT|PERM|PERMISO/.test(String(ev.tipo || '').toUpperCase())).length;
    const annualSubDone = yearGroupedEvents.filter(ev => {
        const tipo = String(ev.tipo || '').toUpperCase();
        return (['VAC', 'BAJA', 'IT', 'PERM', 'PERMISO', 'FORMACION'].includes(window.normalizeTipo ? window.normalizeTipo(ev.tipo) : tipo) || /SUSTITUCION|COBERTURA/i.test(tipo))
            && window.eventHasDestinationIdentity(ev, identityKeys);
    }).length;
    const annualSubRecv = yearGroupedEvents.filter(ev => {
        const tipo = String(ev.tipo || '').toUpperCase();
        return (['VAC', 'BAJA', 'IT', 'PERM', 'PERMISO', 'FORMACION'].includes(window.normalizeTipo ? window.normalizeTipo(ev.tipo) : tipo) || /SUSTITUCION|COBERTURA/i.test(tipo))
            && window.eventHasEmployeeIdentity(ev, identityKeys)
            && (ev.empleado_destino_id || ev.sustituto_id || ev.payload?.sustituto_id || ev.payload?.sustituto);
    }).length;
    const pendingApplies = !isReducedSupport && (
        structuralType === 'fijo'
        || (structuralType === 'temporada' && futureAssignedDays.length > 0)
        || structuralType === 'placeholder'
    );
    const pendingDays = pendingApplies ? unresolvedBaseDays : 0;
    const suspiciousDuplicates = periodGroupedEvents.reduce((acc, ev) => {
        const key = `${ev.fecha_inicio}_${ev.fecha_fin || ev.fecha_inicio}_${window.normalizeTipo ? window.normalizeTipo(ev.tipo) : ev.tipo}_${ev.empleado_destino_id || ev.sustituto_id || ''}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const alerts = [];
    if (!rawTypeField) alerts.push({ level: 'warn', text: 'Empleado sin tipo informado' });
    if (!profile.id_interno) alerts.push({ level: 'warn', text: 'Empleado sin ID interno' });
    if (laborStatus.cls === 'inactivo' && futureAssignedDays.length > 0) alerts.push({ level: 'danger', text: 'Empleado inactivo con turnos futuros' });
    if (['apoyo', 'ocasional'].includes(structuralType) && /refuerzo/.test(window.employeeNorm(rawTypeField))) alerts.push({ level: 'warn', text: 'Apoyo/Ocasional marcado erróneamente como refuerzo' });
    if (groupedEvents.some(ev => ['VAC', 'BAJA', 'IT', 'PERM', 'PERMISO', 'FORMACION'].includes(window.normalizeTipo ? window.normalizeTipo(ev.tipo) : String(ev.tipo || '').toUpperCase()) && !(ev.empleado_destino_id || ev.sustituto_id || ev.payload?.sustituto_id || ev.payload?.sustituto))) {
        alerts.push({ level: 'warn', text: 'Evento sin sustituto' });
    }
    if (cambioEvents.some(ev => !monthDays.some(day => day.cambio && day.fecha >= String(ev.fecha_inicio || '').slice(0, 10) && day.fecha <= String(ev.fecha_fin || ev.fecha_inicio || '').slice(0, 10)))) {
        alerts.push({ level: 'warn', text: 'Cambio de turno sin turno resultante visible' });
    }
    if (Object.values(suspiciousDuplicates).some(count => count > 1)) alerts.push({ level: 'warn', text: 'Duplicidad sospechosa en eventos del periodo' });
    if (structuralType === 'placeholder') alerts.push({ level: 'danger', text: 'Placeholder en uso operativo' });
    const resumenGlobal = {
        ausencias: periodGroupedEvents.filter(ev => /VAC|BAJA|PERM|IT/i.test(String(ev.tipo || ''))).length,
        bajas: periodGroupedEvents.filter(ev => /BAJA|IT/i.test(String(ev.tipo || ''))).length,
        cambios: periodGroupedEvents.filter(ev => /CAMBIO|INTERCAMBIO|REFUERZO|CT/i.test(String(ev.tipo || ''))).length,
        descansoPendiente: isReducedSupport ? 0 : Math.max(0, (descansos.esperados || 0) - (descansos.reales || 0)),
        descansosReales: descansos.reales || 0,
        descansosEsperados: descansos.esperados || 0,
        proximosEventos: periodGroupedEvents.filter(ev => (ev.fecha_fin || ev.fecha_inicio) >= todayISO).length
    };

    return {
        emp,
        hoy,
        hotelActual,
        calendario,
        eventosActivos,
        groupedEvents,
        yearGroupedEvents,
        yearGroupedVacs,
        yearLeavePermissionEvents,
        availableYears,
        periodGroupedEvents,
        groupedVacs,
        descansos,
        resumenGlobal,
        structuralType,
        typeMeta,
        laborStatus,
        currentRole: roleToday,
        currentRoleMeta: window.employeeProfileRoleMeta(roleToday),
        incidenciaActiva: activeIncident,
        proximoTurno: nextShiftDay,
        activeTodayEvents,
        substitutionsDone,
        substitutionsReceived,
        explicitRefuerzoEvents,
        leavePermissionEvents,
        cambioEvents,
        alerts,
        pendingPolicy: {
            applies: pendingApplies,
            structuralType,
            days: pendingDays
        },
        periodKpis: {
            turnosBase: turnosBase.length,
            turnosTrabajados: workedDays.length,
            mananas: morningDays,
            tardes: tardeDays,
            noches: nightDays,
            descansos: restDays,
            vacaciones: vacDays,
            bajasPermisos: bajaPermDays,
            cambiosTurno: changeDays || cambioEvents.length,
            sustitucionesRealizadas: substitutionsDone.length,
            sustitucionesRecibidas: substitutionsReceived.length,
            refuerzosExplicitos: explicitRefuerzoEvents.length,
            diasPendiente: pendingDays
        },
        annualKpis: {
            vacacionesPlanificadas: annualVacPlanned,
            bajasPermisos: annualBajas,
            cambiosTurno: annualChanges,
            sustitucionesRealizadas: annualSubDone,
            sustitucionesRecibidas: annualSubRecv,
            refuerzosExplicitos: annualRefuerzos
        },
        vacaciones: {
            applies: !isReducedSupport,
            saldo: isReducedSupport ? 0 : ajuste,
            usadas: isReducedSupport ? 0 : usadas,
            previstas: isReducedSupport ? 0 : previstas,
            neto: isReducedSupport ? 0 : saldoNeto,
            derechoAnual: isReducedSupport ? 0 : derechoAnual
        },
        resumen30d: {
            cambios: (window._lastStats?.[emp.nombre || emp.id]?.cambios || 0)
        }
    };
};
window.nextEmployeeInternalId = () => {
    const max = (window.empleadosGlobales || []).reduce((acc, emp) => {
        const raw = String(emp.id_interno || emp.id || '');
        const match = raw.match(/^EMP-(\d+)$/i);
        return match ? Math.max(acc, Number(match[1] || 0)) : acc;
    }, 0);
    return `EMP-${String(max + 1).padStart(4, '0')}`;
};

window.syncNewEmployeeHotelAssignments = () => {
    const hotel = document.getElementById('new-emp-hotel')?.value || '';
    document.querySelectorAll('input[name="new-emp-hoteles"]').forEach(input => {
        if (input.value === hotel) input.checked = true;
    });
};

window.openNewEmployeeDrawer = () => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    const drawerHeader = drawer?.querySelector('.drawer-header');
    if (!drawer || !body) return;
    const nextId = window.nextEmployeeInternalId ? window.nextEmployeeInternalId() : 'EMP-0001';
    drawer.classList.add('open');
    if (drawerHeader) {
        drawerHeader.innerHTML = `
            <div class="emp-drawer-topbar" style="display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 28px 12px;">
                <h3 id="drawerTitle" style="margin:0; font-size:0.98rem; font-weight:800; color:var(--text);">Nuevo empleado</h3>
                <button class="btn-close-drawer" onclick="window.closeEmpDrawer()" aria-label="Cerrar" style="margin-left:auto;">&times;</button>
            </div>
        `;
    }
    body.innerHTML = `
        <div class="employee-profile-container" style="padding:10px;">
            <section class="emp-card glass emp-edit-card" style="padding:20px; border-radius:18px; border:1px solid var(--border);">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px;">
                    <div>
                        <h3 style="margin:0; font-size:0.95rem; font-weight:900; color:var(--text);">Ficha inteligente</h3>
                        <div style="margin-top:4px; font-size:0.74rem; color:var(--text-dim); font-weight:700;">El ID interno se genera autom&aacute;ticamente y queda bloqueado para mantener la integridad.</div>
                    </div>
                    <span class="emp-id-lock"><i class="fas fa-lock"></i> ${escapeHtml(nextId)}</span>
                </div>
                <form class="emp-edit-form" onsubmit="window.saveNewEmployeeInline(event)">
                    <label><span>ID interno</span><input id="new-emp-id-interno" type="text" value="${escapeHtml(nextId)}" disabled><small>No editable</small></label>
                    <label><span>ID t&eacute;cnico</span><input id="new-emp-id" type="text" value="${escapeHtml(nextId)}" disabled><small>Clave de sistema</small></label>
                    <label><span>Nombre</span><input id="new-emp-nombre" type="text" required placeholder="Nombre y apellidos"></label>
                    <label><span>Puesto</span><input id="new-emp-puesto" type="text" placeholder="Recepcionista, Direcci&oacute;n..."></label>
                    <label><span>Hotel principal</span><select id="new-emp-hotel" required onchange="window.syncNewEmployeeHotelAssignments?.()">
                        <option value="">Seleccionar</option>
                        <option value="Cumbria Spa&Hotel">Cumbria Spa&Hotel</option>
                        <option value="Sercotel Guadiana">Sercotel Guadiana</option>
                    </select></label>
                    <label><span>Tipo</span><select id="new-emp-tipo" onchange="window.toggleEmployeeSupportFields?.(this.value)">
                        <option value="fijo">Fijo</option>
                        <option value="apoyo">Apoyo</option>
                        <option value="ocasional">Ocasional</option>
                        <option value="sustituto">Sustituto</option>
                    </select></label>
                    <label class="emp-role-field"><span>Rol</span><select id="new-emp-rol">
                        ${window.employeeRoleOptionsHTML('titular')}
                    </select><small>Define su funci&oacute;n base en la configuraci&oacute;n.</small></label>
                    <fieldset class="emp-hotel-assignment span-2">
                        <legend>Hoteles asignados</legend>
                        <label><input type="checkbox" name="new-emp-hoteles" value="Cumbria Spa&Hotel"> <span>Cumbria Spa&Hotel</span></label>
                        <label><input type="checkbox" name="new-emp-hoteles" value="Sercotel Guadiana"> <span>Sercotel Guadiana</span></label>
                        <small>Marca ambos si el empleado trabaja en los dos hoteles.</small>
                    </fieldset>
                    <label><span>Estado laboral</span><select id="new-emp-estado"><option value="Activo" selected>Activo</option><option value="Baja">Baja</option><option value="Excedencia">Excedencia</option></select></label>
                    <label><span>Email</span><input id="new-emp-email" type="email"></label>
                    <label><span>Tel&eacute;fono</span><input id="new-emp-telefono" type="text"></label>
                    <div id="supportReducedNotice" class="emp-support-note span-2" hidden>Personal de apoyo/ocasional: ficha reducida. No computa vacaciones ni descansos pendientes.</div>
                    <label data-balance-field><span>Vacaciones/a&ntilde;o</span><input id="new-emp-vac-anuales" type="number" min="0" step="1" value="44"></label>
                    <label data-balance-field><span>Ajuste vacaciones</span><input id="new-emp-vac-ajuste" type="number" step="1" value="0"></label>
                    <label class="span-2"><span>Observaciones</span><textarea id="new-emp-observaciones" rows="3"></textarea></label>
                    <div class="emp-edit-actions span-2">
                        <span id="empProfileSaveStatus">Completa la ficha y guarda para crear el empleado.</span>
                        <button type="submit" class="emp-save-btn"><i class="fas fa-user-plus"></i> Crear empleado</button>
                    </div>
                </form>
            </section>
        </div>
    `;
};

window.saveNewEmployeeInline = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    const status = document.getElementById('empProfileSaveStatus');
    const setStatus = (text, cls = '') => {
        if (!status) return;
        status.textContent = text;
        status.className = cls;
    };
    const idInterno = document.getElementById('new-emp-id-interno')?.value || (window.nextEmployeeInternalId ? window.nextEmployeeInternalId() : 'EMP-0001');
    const id = document.getElementById('new-emp-id')?.value || idInterno;
    const nombre = document.getElementById('new-emp-nombre')?.value?.trim() || '';
    const hotel = document.getElementById('new-emp-hotel')?.value || '';
    const tipo = document.getElementById('new-emp-tipo')?.value || 'fijo';
    const rol = document.getElementById('new-emp-rol')?.value || 'titular';
    const estado = document.getElementById('new-emp-estado')?.value || 'Activo';
    const hotelesAsignados = Array.from(document.querySelectorAll('input[name="new-emp-hoteles"]:checked')).map(input => input.value);
    if (hotel && !hotelesAsignados.includes(hotel)) hotelesAsignados.unshift(hotel);
    if (!nombre) { setStatus('El nombre es obligatorio.', 'error'); return; }
    if (!hotel) { setStatus('Selecciona el hotel principal.', 'error'); return; }
    if ((window.empleadosGlobales || []).some(emp => String(emp.id_interno || '').toUpperCase() === idInterno.toUpperCase() || String(emp.id || '').toUpperCase() === id.toUpperCase())) {
        setStatus('Ese ID ya existe. Cierra y vuelve a abrir la ficha para generar otro.', 'error');
        return;
    }
    const isReducedSupport = ['apoyo', 'ocasional'].includes(String(tipo).toLowerCase());
    const payload = {
        id,
        id_interno: idInterno,
        nombre,
        email: document.getElementById('new-emp-email')?.value?.trim() || null,
        telefono: document.getElementById('new-emp-telefono')?.value?.trim() || null,
        hotel: hotel,
        hotel_id: hotel,
        hoteles_asignados: hotelesAsignados,
        puesto: document.getElementById('new-emp-puesto')?.value?.trim() || null,
        categoria: document.getElementById('new-emp-puesto')?.value?.trim() || null,
        tipo,
        tipo_personal: tipo,
        contrato: tipo,
        rol,
        rol_operativo: rol,
        estado,
        estado_empresa: estado,
        activo: estado === 'Activo',
        vacaciones_anuales: isReducedSupport ? null : Number(document.getElementById('new-emp-vac-anuales')?.value || 44),
        ajuste_vacaciones_dias: isReducedSupport ? 0 : Number(document.getElementById('new-emp-vac-ajuste')?.value || 0),
        observaciones: document.getElementById('new-emp-observaciones')?.value?.trim() || null
    };
    try {
        setStatus('Creando empleado...', 'pending');
        await window.TurnosDB.upsertEmpleado(payload);
        window.empleadosGlobales = await window.TurnosDB.getEmpleados();
        if (window.populateEmployees) await window.populateEmployees();
        setStatus('Empleado creado correctamente.', 'saved');
        await window.openEmpDrawer(id);
        window._employeeProfileTab = 'profile';
        window.renderEmployeeProfile();
    } catch (e) {
        console.error('[EMP CREATE ERROR]', e);
        setStatus('Error al crear: ' + e.message, 'error');
    }
};
window.openEmpDrawer = async (id) => {
    window._employeeProfileId = id;
    window._employeeProfileTab = 'summary';
    window._employeeProfileDate = window.isoDate(new Date());
    await window.loadEmployeeProfileBaseRows(id, window._employeeProfileDate);
    
    const drawer = $('#empDrawer');
    if (drawer) {
        drawer.classList.add('open');
        window.renderEmployeeProfile();
    }
};

window.setEmployeeProfileTab = (tab) => {
    window._employeeProfileTab = tab;
    window.renderEmployeeProfile();
};

window.moveEmployeeProfilePeriod = async (months) => {
    const d = new Date(window._employeeProfileDate + 'T12:00:00');
    d.setMonth(d.getMonth() + months);
    window._employeeProfileDate = window.isoDate(d);
    await window.loadEmployeeProfileBaseRows(window._employeeProfileId, window._employeeProfileDate);
    window.renderEmployeeProfile();
};

window.setEmployeeProfileYear = async (year) => {
    const parsedYear = Number(year);
    if (!Number.isFinite(parsedYear)) return;
    window._employeeProfileDate = `${parsedYear}-01-01`;
    if (window._employeeProfileId && window.loadEmployeeProfileBaseRows) {
        await window.loadEmployeeProfileBaseRows(window._employeeProfileId, window._employeeProfileDate);
    }
    window.renderEmployeeProfile();
};

window.openEmployeeDayDetail = (date) => {
    console.log("Detalle del día:", date);
    // Podríamos abrir un mini-modal con los detalles técnicos del turno resuelto
};

window.toggleEmployeeSupportFields = (type) => {
    const reduced = ['apoyo', 'ocasional'].includes(String(type || '').toLowerCase());
    document.querySelectorAll('[data-balance-field]').forEach(el => { el.hidden = reduced; });
    const note = document.getElementById('supportReducedNotice');
    if (note) note.hidden = !reduced;
};
window.renderEmployeeProfileEditForm = (emp, model) => {
    const currentEstado = emp.estado_empresa || emp.estado || (emp.activo === false ? 'Baja' : 'Activo');
    const currentTipo = emp.tipo_personal || emp.contrato || emp.tipo || 'fijo';
    const currentHotel = emp.hotel_id || emp.hotel || '';
    const assignedHotelsRaw = Array.isArray(emp.hoteles_asignados) ? emp.hoteles_asignados : (typeof emp.hoteles_asignados === 'string' ? emp.hoteles_asignados.split(/[,;|]/).map(h => h.trim()).filter(Boolean) : []);
    const assignedHotels = new Set(assignedHotelsRaw.length ? assignedHotelsRaw : (currentHotel ? [currentHotel] : []));
    const isReducedSupport = ['apoyo', 'ocasional'].includes(String(currentTipo).toLowerCase());
    const currentRole = window.employeeConfiguredRole ? window.employeeConfiguredRole(emp) : (emp.rol_operativo || emp.rol || 'titular');
    return `
        <section class="emp-card glass emp-edit-card" style="padding:20px; border-radius:18px; border:1px solid var(--border);">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px;">
                <div>
                    <h3 style="margin:0; font-size:0.95rem; font-weight:900; color:var(--text);">Datos de ficha</h3>
                    <div style="margin-top:4px; font-size:0.74rem; color:var(--text-dim); font-weight:700;">El identificador interno queda bloqueado para preservar la integridad del cuadrante.</div>
                </div>
                <span class="emp-id-lock"><i class="fas fa-lock"></i> ${escapeHtml(emp.id_interno || emp.id || 'Sin ID')}</span>
            </div>
            <form class="emp-edit-form" onsubmit="window.saveEmployeeProfileInline(event)">
                <label><span>ID interno</span><input type="text" value="${escapeHtml(emp.id_interno || '')}" disabled><small>No editable</small></label>
                <label><span>ID t&eacute;cnico</span><input type="text" value="${escapeHtml(emp.id || '')}" disabled><small>Clave de sistema</small></label>
                <label><span>Nombre</span><input id="edit-emp-nombre" type="text" value="${escapeHtml(emp.nombre || '')}"></label>
                <label><span>Puesto</span><input id="edit-emp-puesto" type="text" value="${escapeHtml(emp.puesto || emp.categoria || '')}"></label>
                <label><span>Hotel principal</span><select id="edit-emp-hotel">
                    <option value="">Seleccionar</option>
                    <option value="Cumbria Spa&Hotel" ${currentHotel === 'Cumbria Spa&Hotel' ? 'selected' : ''}>Cumbria Spa&Hotel</option>
                    <option value="Sercotel Guadiana" ${currentHotel === 'Sercotel Guadiana' ? 'selected' : ''}>Sercotel Guadiana</option>
                </select></label>
                <label><span>Tipo</span><select id="edit-emp-tipo" onchange="window.toggleEmployeeSupportFields?.(this.value)">
                    ${['fijo', 'apoyo', 'ocasional', 'sustituto'].map(tipo => `<option value="${tipo}" ${String(currentTipo).toLowerCase() === tipo ? 'selected' : ''}>${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</option>`).join('')}
                </select></label>
                <label class="emp-role-field"><span>Rol</span><select id="edit-emp-rol">
                    ${window.employeeRoleOptionsHTML(currentRole)}
                </select><small>Funci&oacute;n base para el control operativo.</small></label>
                <fieldset class="emp-hotel-assignment span-2">
                    <legend>Hoteles asignados</legend>
                    <label><input type="checkbox" name="edit-emp-hoteles" value="Cumbria Spa&Hotel" ${assignedHotels.has('Cumbria Spa&Hotel') ? 'checked' : ''}> <span>Cumbria Spa&Hotel</span></label>
                    <label><input type="checkbox" name="edit-emp-hoteles" value="Sercotel Guadiana" ${assignedHotels.has('Sercotel Guadiana') ? 'checked' : ''}> <span>Sercotel Guadiana</span></label>
                    <small>Marca ambos si el empleado trabaja en los dos hoteles.</small>
                </fieldset>
                <label><span>Estado laboral</span><select id="edit-emp-estado">
                    ${['Activo', 'Baja', 'Excedencia'].map(estado => `<option value="${estado}" ${currentEstado === estado ? 'selected' : ''}>${estado}</option>`).join('')}
                </select></label>
                <label><span>Email</span><input id="edit-emp-email" type="email" value="${escapeHtml(emp.email || '')}"></label>
                <label><span>Tel&eacute;fono</span><input id="edit-emp-telefono" type="text" value="${escapeHtml(emp.telefono || '')}"></label>
                <div id="supportReducedNotice" class="emp-support-note span-2" ${isReducedSupport ? '' : 'hidden'}>Personal de apoyo/ocasional: ficha reducida. No computa vacaciones ni descansos pendientes.</div>
                <label data-balance-field ${isReducedSupport ? 'hidden' : ''}><span>Vacaciones/a&ntilde;o</span><input id="edit-emp-vac-anuales" type="number" min="0" step="1" value="${escapeHtml(emp.vacaciones_anuales || model?.vacaciones?.derechoAnual || 44)}"></label>
                <label data-balance-field ${isReducedSupport ? 'hidden' : ''}><span>Ajuste vacaciones</span><input id="edit-emp-vac-ajuste" type="number" step="1" value="${escapeHtml(emp.ajuste_vacaciones_dias || 0)}"></label>
                <label class="span-2"><span>Observaciones</span><textarea id="edit-emp-observaciones" rows="3">${escapeHtml(emp.observaciones || emp.notas || '')}</textarea></label>
                <div class="emp-edit-actions span-2">
                    <span id="empProfileSaveStatus">El ID no se modifica en este formulario.</span>
                    <button type="submit" class="emp-save-btn">Guardar cambios</button>
                </div>
            </form>
        </section>
    `;
};
window.renderEmployeeProfile = () => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    const drawerHeader = drawer?.querySelector('.drawer-header');
    if (!drawer || !body) return;
    try {
    const currentTab = window._employeeProfileTab || 'summary';
    const refISO = window._employeeProfileDate || window.isoDate(new Date());
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, refISO);
    if (!model) {
        body.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;">Empleado no encontrado.</div>';
        return;
    }
    drawer.classList.add('open');
    const emp = model.emp;
    const refDate = new Date(`${refISO}T12:00:00`);
    const titlePeriod = refDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const currentShiftLabel = model.hoy ? window.employeeShiftLabel(model.hoy).replace('&mdash;', '—') : 'No informado';
    const nextShiftLabel = model.proximoTurno ? `${window.employeeShiftLabel(model.proximoTurno).replace('&mdash;', '—')} · ${window.fmtDateLegacy(model.proximoTurno.fecha)}` : 'Sin turno futuro';
    const incidenciaLabel = model.incidenciaActiva ? window.employeeProfileEventLabel(model.incidenciaActiva) : 'Sin incidencia';
    const assignedHotels = Array.isArray(emp.hoteles_asignados) ? emp.hoteles_asignados.filter(Boolean) : (typeof emp.hoteles_asignados === 'string' ? emp.hoteles_asignados.split(/[,;|]/).map(h => h.trim()).filter(Boolean) : []);
    const assignedHotelLabel = assignedHotels.length > 1 ? 'Ambos hoteles' : (assignedHotels[0] || emp.hotel || 'No informado');
    const vacationBalanceLabel = model.vacaciones?.applies ? `${model.vacaciones.neto} dias` : 'No aplica';
    const tabs = [
        ['summary', 'Resumen'],
        ['profile', 'Ficha'],
        ['turns', 'Turnos'],
        ['vacations', 'Vacaciones'],
        ['leaves', 'Bajas / Permisos'],
        ['changes', 'Cambios de Turno'],
        ['substitutions', 'Sustituciones'],
        ['reinforcements', 'Refuerzos'],
        ['history', 'Historial']
    ];
    if (drawerHeader) {
        drawerHeader.innerHTML = `
            <div class="emp-drawer-topbar" style="display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 28px 12px;">
                <h3 id="drawerTitle" style="margin:0; font-size:0.98rem; font-weight:800; color:var(--text);">Detalle Empleado</h3>
                <button class="btn-close-drawer" onclick="window.closeEmpDrawer()" aria-label="Cerrar" style="margin-left:auto;">&times;</button>
            </div>
            <div class="emp-tabs-nav" style="display:flex; gap:10px; border-bottom:1px solid var(--border); padding:0 28px 12px; flex-wrap:wrap;">
                ${tabs.map(([key, label]) => `<button class="emp-tab-btn ${currentTab === key ? 'active' : ''}" onclick="window.setEmployeeProfileTab('${key}')" style="background:none; border:none; padding:8px 4px; color:var(--text-dim); font-weight:700; cursor:pointer; font-size:0.83rem;">${label}</button>`).join('')}
            </div>
        `;
    }
    const monthRows = (model.calendario || []).filter(day => !day.outsideMonth);
    const renderRowsTable = (rows, emptyText) => rows.length > 0 ? `<div style="display:grid; gap:10px;">${rows.map(row => `<div style="display:grid; grid-template-columns:92px 1fr 1fr 120px; gap:12px; align-items:center; padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:white;"><strong style="font-size:0.78rem; color:var(--text);">${escapeHtml(row.fecha || '—')}</strong><span style="font-size:0.78rem; color:var(--text);">${row.main}</span><span style="font-size:0.76rem; color:var(--text-dim);">${row.secondary || '—'}</span><span style="font-size:0.74rem; color:var(--accent); font-weight:700; text-align:right;">${row.badge || '—'}</span></div>`).join('')}</div>` : `<div style="padding:26px; text-align:center; opacity:0.45; font-size:0.82rem;">${emptyText}</div>`;
    const alertHTML = model.alerts.length > 0 ? `<section class="emp-card glass" style="padding:18px 20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 12px; font-size:0.88rem; font-weight:800;">Alertas</h3><div style="display:grid; gap:10px;">${model.alerts.map(alert => `<div class="emp-alert-box" style="display:flex; align-items:flex-start; gap:10px; padding:11px 13px; border-radius:13px; border:1px solid ${alert.level === 'danger' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}; background:${alert.level === 'danger' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)'};"><i class="fas ${alert.level === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-info'}" style="color:${alert.level === 'danger' ? '#dc2626' : '#d97706'};"></i><span style="font-size:0.8rem; font-weight:600; color:var(--text);">${escapeHtml(alert.text)}</span></div>`).join('')}</div></section>` : '';
    const headerHTML = `<div class="emp-premium-header"><div class="emp-header-info"><div class="emp-avatar" style="background:var(--accent); color:white; width:52px; height:52px; border-radius:15px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800; box-shadow:0 8px 16px rgba(0,0,0,0.08);">${escapeHtml((emp.nombre || 'E').charAt(0))}</div><div class="emp-title-block"><h2 style="margin:0; font-size:1.2rem; font-weight:800; color:var(--text);">${escapeHtml(emp.nombre)}</h2><div style="margin-top:4px; font-size:0.74rem; color:#94a3b8; font-weight:600;">${escapeHtml(emp.id_interno || 'No informado')}</div><div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;"><span class="status-pill ${model.typeMeta.cls}">${escapeHtml(model.typeMeta.label)}</span><span class="status-pill ${model.laborStatus.cls}">${escapeHtml(model.laborStatus.label)}</span><span class="status-pill ${model.currentRoleMeta.cls}">${escapeHtml(model.currentRoleMeta.label)}</span><span class="status-pill activo">${escapeHtml(assignedHotelLabel)}</span></div></div></div><div class="emp-header-actions" style="display:grid; gap:4px; text-align:right; max-width:230px;"><div style="font-size:0.72rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">Edición</div><div style="font-size:0.82rem; color:var(--text); font-weight:700;">ID protegido</div><div style="font-size:0.72rem; color:var(--text-dim); line-height:1.35;">El ID interno no se edita. El resto de datos se gestiona desde la pesta&ntilde;a Ficha.</div></div></div>`;
    const kpiHTML = `<div class="emp-kpi-grid" style="display:grid; grid-template-columns:repeat(6, minmax(120px, 1fr)); gap:12px; margin-bottom:18px;"><div class="emp-kpi-card glass" style="padding:14px; border-radius:16px; border:1px solid var(--border);"><label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Rol actual</label><strong style="font-size:0.98rem; color:var(--text);">${escapeHtml(model.currentRoleMeta.label)}</strong></div><div class="emp-kpi-card glass" style="padding:14px; border-radius:16px; border:1px solid var(--border);"><label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Estado operativo</label><strong style="font-size:0.98rem; color:var(--text);">${escapeHtml(currentShiftLabel)}</strong></div><div class="emp-kpi-card glass" style="padding:14px; border-radius:16px; border:1px solid var(--border);"><label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Próximo turno</label><strong style="font-size:0.9rem; color:var(--text);">${escapeHtml(nextShiftLabel)}</strong></div><div class="emp-kpi-card glass" style="padding:14px; border-radius:16px; border:1px solid var(--border);"><label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Incidencia</label><strong style="font-size:0.9rem; color:var(--text);">${escapeHtml(incidenciaLabel)}</strong></div><div class="emp-kpi-card glass" style="padding:14px; border-radius:16px; border:1px solid var(--border);"><label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Pendientes</label><strong style="font-size:0.98rem; color:var(--text);">${model.pendingPolicy.applies ? model.periodKpis.diasPendiente : 'No aplica'}</strong></div><div class="emp-kpi-card glass" style="padding:14px; border-radius:16px; border:1px solid var(--border);"><label style="display:block; font-size:0.6rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Saldo vac.</label><strong style="font-size:0.98rem; color:#10b981;">${escapeHtml(vacationBalanceLabel)}</strong></div></div>`;
    let tabContent = '';
    if (currentTab === 'summary') {
        tabContent = `<div style="display:grid; gap:18px;"><div class="emp-grid" style="display:grid; grid-template-columns:1.1fr 1fr; gap:18px;"><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Identidad y estado</h3><div style="display:grid; gap:10px;">${window.renderEmployeeProfileField(['Hotel principal', emp.hotel || 'No informado'])}${window.renderEmployeeProfileField(['Hoteles asignados', assignedHotelLabel])}${window.renderEmployeeProfileField(['Tipo de empleado', model.typeMeta.label])}${window.renderEmployeeProfileField(['Estado laboral', model.laborStatus.label])}${window.renderEmployeeProfileField(['Rol operativo actual', model.currentRoleMeta.label])}${window.renderEmployeeProfileField(['Próximo turno', nextShiftLabel])}${window.renderEmployeeProfileField(['Incidencia activa', incidenciaLabel])}</div></section><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">KPIs del periodo</h3><div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">${window.renderEmployeeProfileField(['Turnos base', model.periodKpis.turnosBase])}${window.renderEmployeeProfileField(['Turnos trabajados', model.periodKpis.turnosTrabajados])}${window.renderEmployeeProfileField(['Mañanas', model.periodKpis.mananas])}${window.renderEmployeeProfileField(['Tardes', model.periodKpis.tardes])}${window.renderEmployeeProfileField(['Noches', model.periodKpis.noches])}${window.renderEmployeeProfileField(['Descansos', model.periodKpis.descansos])}${window.renderEmployeeProfileField(['Vacaciones', model.periodKpis.vacaciones])}${window.renderEmployeeProfileField(['Bajas / Permisos', model.periodKpis.bajasPermisos])}${window.renderEmployeeProfileField(['Cambios de turno', model.periodKpis.cambiosTurno])}${window.renderEmployeeProfileField(['Sustituciones realizadas', model.periodKpis.sustitucionesRealizadas])}${window.renderEmployeeProfileField(['Sustituciones recibidas', model.periodKpis.sustitucionesRecibidas])}${window.renderEmployeeProfileField(['Refuerzos explícitos', model.periodKpis.refuerzosExplicitos])}</div></section></div><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Vision anual ${refDate.getFullYear()}</h3><div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px;">${window.renderEmployeeProfileField(['Vacaciones previstas', model.vacaciones.applies ? `${model.annualKpis.vacacionesPlanificadas} dias` : 'No aplica'])}${window.renderEmployeeProfileField(['Bajas / Permisos', model.annualKpis.bajasPermisos])}${window.renderEmployeeProfileField(['Cambios de turno', model.annualKpis.cambiosTurno])}${window.renderEmployeeProfileField(['Sustituciones realizadas', model.annualKpis.sustitucionesRealizadas])}${window.renderEmployeeProfileField(['Sustituciones recibidas', model.annualKpis.sustitucionesRecibidas])}${window.renderEmployeeProfileField(['Refuerzos explícitos', model.annualKpis.refuerzosExplicitos])}</div></section><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Pendientes y balance</h3><div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px;">${window.renderEmployeeProfileField(['Cuenta para pendientes', model.pendingPolicy.applies ? 'Sí' : 'No'])}${window.renderEmployeeProfileField(['Días con pendiente', model.pendingPolicy.applies ? model.periodKpis.diasPendiente : 'No aplica'])}${window.renderEmployeeProfileField(['Descanso pendiente', model.pendingPolicy.applies ? model.resumenGlobal.descansoPendiente : 'No aplica'])}${window.renderEmployeeProfileField(['Saldo vacacional neto', vacationBalanceLabel])}</div></section>${alertHTML}</div>`;
    } else if (currentTab === 'profile') {
        tabContent = window.renderEmployeeProfileEditForm(emp, model);
    } else if (currentTab === 'turns') {
        const tableRows = monthRows.map(day => { const finalMeta = window.employeeProfileShiftCodeMeta(day.turno || day.detalle?.turno); const baseMeta = window.employeeProfileShiftCodeMeta(day.turnoBase || day.detalle?.turnoBase); return { fecha: day.fecha, main: `<strong>${escapeHtml(day.diaSemana || new Date(`${day.fecha}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short' }))}</strong> · ${escapeHtml(emp.hotel || model.hotelActual || 'No informado')}`, secondary: `Base: ${escapeHtml(baseMeta.code)} · Resuelto: ${escapeHtml(finalMeta.code)}${day.cambio ? ' 🔄' : ''}${finalMeta.code === 'N' ? ' 🌙' : ''}${day.incidencia ? ` · ${escapeHtml(window.employeeProfileEventLabel(day.incidencia))}` : ''}`, badge: escapeHtml(day.detalle?.origen || day.incidencia?.tipo || 'base') }; });
        tabContent = `<div style="display:grid; grid-template-columns:1.2fr 0.9fr; gap:18px; align-items:start;"><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;"><div><h3 style="margin:0; font-size:0.9rem; font-weight:800;">Turnos del periodo</h3><div style="font-size:0.72rem; color:var(--text-dim); font-weight:700; margin-top:4px;">Navegacion mensual</div></div><div style="display:flex; gap:8px;"><button onclick="window.moveEmployeeProfilePeriod(-1)" class="btn-premium" aria-label="Mes anterior" title="Mes anterior" style="padding:8px 12px; min-width:118px; border-radius:12px; font-weight:800;"><i class="fas fa-chevron-left" style="margin-right:8px;"></i>Anterior</button><button onclick="window.moveEmployeeProfilePeriod(1)" class="btn-premium" aria-label="Mes siguiente" title="Mes siguiente" style="padding:8px 12px; min-width:118px; border-radius:12px; font-weight:800;">Siguiente<i class="fas fa-chevron-right" style="margin-left:8px;"></i></button></div></div><div style="margin-bottom:12px; font-size:0.8rem; color:var(--accent); font-weight:800; text-transform:capitalize;">${titlePeriod}</div>${renderRowsTable(tableRows, 'No hay turnos para este periodo.')}</section><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Calendario</h3>${window.renderEmployeeProfileCalendar(model)}</section></div>`;
    } else if (currentTab === 'vacations') {
        const vacRows = (model.yearGroupedVacs || []).sort((a, b) => String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || ''))).map(ev => { const days = Math.max(1, Math.round((new Date(`${ev.fecha_fin || ev.fecha_inicio}T12:00:00`) - new Date(`${ev.fecha_inicio}T12:00:00`)) / 86400000) + 1); return { fecha: ev.fecha_inicio, main: `<strong>${escapeHtml(window.employeeProfileDateRangeLabel(ev.fecha_inicio, ev.fecha_fin || ev.fecha_inicio))}</strong>`, secondary: `${days} días naturales${ev.isGroup ? ' · agrupado' : ''} · ${refDate.getFullYear()}`, badge: escapeHtml(ev.estado || 'activo') }; });
        tabContent = `<div style="display:grid; grid-template-columns:1.1fr 0.9fr; gap:18px;"><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Vacaciones ${refDate.getFullYear()}</h3>${renderRowsTable(vacRows, 'No hay vacaciones registradas en el año en curso.')}</section><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Saldo vacacional</h3><div style="display:grid; gap:10px;">${window.renderEmployeeProfileField(['Derecho anual', model.vacaciones.applies ? `${model.vacaciones.derechoAnual} dias` : 'No aplica'])}${window.renderEmployeeProfileField(['Consumidas', model.vacaciones.applies ? `${model.vacaciones.usadas} dias` : 'No aplica'])}${window.renderEmployeeProfileField(['Previstas a�o', model.vacaciones.applies ? `${model.annualKpis.vacacionesPlanificadas} dias` : 'No aplica'])}${window.renderEmployeeProfileField(['Previstas futuras', model.vacaciones.applies ? `${model.vacaciones.previstas} dias` : 'No aplica'])}${window.renderEmployeeProfileField(['Ajustes', model.vacaciones.applies ? `${model.vacaciones.saldo >= 0 ? '+' : ''}${model.vacaciones.saldo} dias` : 'No aplica'])}${window.renderEmployeeProfileField(['Saldo neto', vacationBalanceLabel])}</div></section></div>`;
    } else if (currentTab === 'leaves') {
        const selectedYear = refDate.getFullYear();
        const yearStart = `${selectedYear}-01-01`;
        const yearEnd = `${selectedYear}-12-31`;
        const years = (model.availableYears || [selectedYear]).filter(Number.isFinite);
        const countNaturalDays = (ev) => {
            const start = String(ev.fecha_inicio || '').slice(0, 10);
            const end = String(ev.fecha_fin || start || '').slice(0, 10);
            const clippedStart = start < yearStart ? yearStart : start;
            const clippedEnd = end > yearEnd ? yearEnd : end;
            if (!clippedStart || !clippedEnd || clippedEnd < clippedStart) return 0;
            return Math.max(1, Math.round((new Date(`${clippedEnd}T12:00:00`) - new Date(`${clippedStart}T12:00:00`)) / 86400000) + 1);
        };
        const leaveEventsYear = (model.yearLeavePermissionEvents || []).slice().sort((a, b) => String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || '')));
        const leaveRows = leaveEventsYear.map(ev => {
            const days = countNaturalDays(ev);
            return {
                fecha: ev.fecha_inicio,
                main: `<strong>${escapeHtml(window.employeeProfileEventLabel(ev))}</strong> · ${escapeHtml(window.employeeProfileDateRangeLabel(ev.fecha_inicio, ev.fecha_fin || ev.fecha_inicio))}`,
                secondary: `${days} dia${days === 1 ? '' : 's'} naturales · ${escapeHtml(ev.observaciones || 'Sin observaciones')}`,
                badge: escapeHtml(ev.estado || 'activo')
            };
        });
        const totalDays = leaveEventsYear.reduce((acc, ev) => acc + countNaturalDays(ev), 0);
        const yearTabs = `<div class="emp-year-tabs">${years.map(year => `<button type="button" class="emp-year-tab ${year === selectedYear ? 'active' : ''}" onclick="window.setEmployeeProfileYear(${year})">${year}</button>`).join('')}</div>`;
        tabContent = `<section class="emp-card glass emp-year-card" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><div class="emp-year-header"><div><h3 style="margin:0 0 6px; font-size:0.9rem; font-weight:800;">Bajas / Permisos ${selectedYear}</h3><div class="emp-year-subtitle">Mostrando todo el año natural, del 01/01/${selectedYear} al 31/12/${selectedYear}.</div></div>${yearTabs}</div><div class="emp-leave-summary"><span><strong>${leaveEventsYear.length}</strong> registros</span><span><strong>${totalDays}</strong> días naturales</span></div>${renderRowsTable(leaveRows, `No hay bajas ni permisos registrados en ${selectedYear}.`)}</section>`;
    } else if (currentTab === 'changes') {
        const changeRows = model.cambioEvents.map(ev => ({ fecha: ev.fecha_inicio, main: `<strong>${escapeHtml(window.employeeProfileEventLabel(ev))}</strong> · ${escapeHtml(window.employeeProfileDateRangeLabel(ev.fecha_inicio, ev.fecha_fin || ev.fecha_inicio))}`, secondary: `${escapeHtml(ev.observaciones || 'Sin observaciones')} · origen ${escapeHtml(window.employeeProfileReadableSource(ev))}`, badge: `${escapeHtml(ev.estado || 'activo')} 🔄` }));
        tabContent = `<section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Cambios de turno</h3>${renderRowsTable(changeRows, 'No hay cambios de turno en este periodo.')}</section>`;
    } else if (currentTab === 'substitutions') {
        const doneRows = model.substitutionsDone.map(ev => ({ fecha: ev.fecha_inicio, main: `<strong>${escapeHtml(window.employeeProfileEventLabel(ev))}</strong> · cubre a ${escapeHtml(ev.empleado_id || 'No informado')}`, secondary: `${escapeHtml(window.employeeProfileDateRangeLabel(ev.fecha_inicio, ev.fecha_fin || ev.fecha_inicio))} · hotel ${escapeHtml(window.getEventoHotel ? window.getEventoHotel(ev) : (ev.hotel || ev.hotel_origen || ev.hotel_destino || emp.hotel || 'No informado'))}`, badge: escapeHtml(ev.id || ev.evento_id || 'sin id') }));
        const receivedRows = model.substitutionsReceived.map(ev => ({ fecha: ev.fecha_inicio, main: `<strong>${escapeHtml(window.employeeProfileEventLabel(ev))}</strong> · sustituye ${escapeHtml(ev.empleado_destino_id || ev.sustituto_id || ev.payload?.sustituto || 'No informado')}`, secondary: `${escapeHtml(window.employeeProfileDateRangeLabel(ev.fecha_inicio, ev.fecha_fin || ev.fecha_inicio))} · motivo ${escapeHtml(ev.observaciones || 'Sin observaciones')}`, badge: escapeHtml(ev.id || ev.evento_id || 'sin id') }));
        tabContent = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:18px;"><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Sustituciones realizadas</h3>${renderRowsTable(doneRows, 'No ha realizado sustituciones en este periodo.')}</section><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Sustituciones recibidas</h3>${renderRowsTable(receivedRows, 'No ha recibido sustituciones en este periodo.')}</section></div>`;
    } else if (currentTab === 'reinforcements') {
        const refRows = model.explicitRefuerzoEvents.map(ev => ({ fecha: ev.fecha_inicio, main: `<strong>${escapeHtml(window.employeeProfileDateRangeLabel(ev.fecha_inicio, ev.fecha_fin || ev.fecha_inicio))}</strong> · ${escapeHtml(window.getEventoHotel ? window.getEventoHotel(ev) : (ev.hotel || ev.hotel_origen || ev.hotel_destino || emp.hotel || 'No informado'))}`, secondary: `Turno ${escapeHtml(ev.turno || ev.payload?.turno || 'No informado')} · origen ${escapeHtml(window.employeeProfileReadableSource(ev))}`, badge: escapeHtml(ev.id || ev.evento_id || 'sin id') }));
        tabContent = `<section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Refuerzos explícitos</h3>${renderRowsTable(refRows, 'No hay refuerzos explícitos para este empleado en el periodo.')}</section>`;
    } else if (currentTab === 'history') {
        const historyRows = (model.yearGroupedEvents || model.groupedEvents || []).slice().sort((a, b) => String(b.fecha_inicio || '').localeCompare(String(a.fecha_inicio || ''))).map(ev => ({ fecha: ev.fecha_inicio, main: `<strong>${escapeHtml(window.employeeProfileEventLabel(ev))}</strong> · ${escapeHtml(window.employeeProfileDateRangeLabel(ev.fecha_inicio, ev.fecha_fin || ev.fecha_inicio))}`, secondary: `${escapeHtml(window.employeeProfileActorLabel(ev))} · ${escapeHtml(ev.observaciones || 'Sin observaciones')} · origen ${escapeHtml(window.employeeProfileReadableSource(ev))}`, badge: escapeHtml(ev.estado || 'activo') }));
        tabContent = `<section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 14px; font-size:0.9rem; font-weight:800;">Historial</h3>${renderRowsTable(historyRows, 'No hay histórico de eventos para este empleado.')}</section>`;
    }
    body.innerHTML = `<div class="employee-profile-container" style="padding:10px;">${headerHTML}${kpiHTML}<div class="emp-content-area" style="min-height:400px;">${tabContent}</div><div style="margin-top:24px; padding-top:14px; border-top:1px solid var(--border); font-size:0.66rem; color:var(--text-dim); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;"><span>ID técnico: ${escapeHtml(emp.id || 'N/A')}</span><span>UUID: ${escapeHtml(emp.uuid || 'N/A')}</span><span>Tipo estructural: ${escapeHtml(model.structuralType || 'fijo')}</span></div></div>`;
    } catch (e) {
        console.error('[EMP PROFILE RENDER ERROR]', e);
        body.innerHTML = `<div class="employee-profile-container" style="padding:24px;"><section class="emp-card glass" style="padding:20px; border-radius:18px; border:1px solid var(--border);"><h3 style="margin:0 0 8px; font-size:0.95rem; font-weight:900; color:#dc2626;">No se pudo cargar la ficha</h3><div style="font-size:0.8rem; color:var(--text-dim); font-weight:700;">${escapeHtml(e.message || String(e))}</div></section></div>`;
    }
};

window.saveEmployeeProfileInline = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    const empId = window._employeeProfileId;
    const status = document.getElementById('empProfileSaveStatus');
    const setStatus = (text, cls = '') => {
        if (!status) return;
        status.textContent = text;
        status.className = cls;
    };
    if (!empId) {
        setStatus('No hay empleado seleccionado.', 'error');
        return;
    }

    const estado = $('#edit-emp-estado')?.value || 'Activo';
    const hotel = $('#edit-emp-hotel')?.value || '';
    const tipo = $('#edit-emp-tipo')?.value || 'fijo';
    const rol = $('#edit-emp-rol')?.value || 'titular';
    const hotelesAsignados = Array.from(document.querySelectorAll('input[name="edit-emp-hoteles"]:checked')).map(input => input.value);
    if (hotel && !hotelesAsignados.includes(hotel)) hotelesAsignados.unshift(hotel);
    const isReducedSupport = ['apoyo', 'ocasional'].includes(String(tipo).toLowerCase());
    const payload = {
        id: empId,
        nombre: $('#edit-emp-nombre')?.value?.trim() || empId,
        email: $('#edit-emp-email')?.value?.trim() || null,
        telefono: $('#edit-emp-telefono')?.value?.trim() || null,
        hotel,
        hotel_id: hotel,
        hoteles_asignados: hotelesAsignados,
        puesto: $('#edit-emp-puesto')?.value?.trim() || null,
        categoria: $('#edit-emp-puesto')?.value?.trim() || null,
        tipo: tipo,
        tipo_personal: tipo,
        contrato: tipo,
        rol,
        rol_operativo: rol,
        estado: estado,
        estado_empresa: estado,
        activo: estado === 'Activo',
        vacaciones_anuales: isReducedSupport ? null : Number(document.getElementById('edit-emp-vac-anuales')?.value || 44),
        ajuste_vacaciones_dias: isReducedSupport ? 0 : Number(document.getElementById('edit-emp-vac-ajuste')?.value || 0),
        observaciones: $('#edit-emp-observaciones')?.value?.trim() || null
    };

    try {
        setStatus('Guardando cambios...', 'pending');
        await window.TurnosDB.upsertEmpleado(payload);
        window.empleadosGlobales = await window.TurnosDB.getEmpleados();
        setStatus('Cambios guardados. ID protegido sin modificar.', 'saved');
        if (window.populateEmployees) await window.populateEmployees();
        window._employeeProfileTab = 'profile';
        window.renderEmployeeProfile();
    } catch (e) {
        console.error('[EMP PROFILE SAVE ERROR]', e);
        setStatus('Error al guardar: ' + e.message, 'error');
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.renderDashboard, 1000);
    if (window.TurnosDB?.initRealtime) window.TurnosDB.initRealtime();
    
    // Polling de badges cada 30s (más el tiempo real si está activo)
    window.updateSidebarBadges();
    setInterval(window.updateSidebarBadges, 30000);
});

// INTEGRITY CHECK
console.log("[Admin] Validando carga v13.3...");
["isoDate", "switchSection", "loadAdminExcelSourceRows", "populateEmployees", "renderDashboard", "renderRequests"].forEach(fn => {
    if (typeof window[fn] !== "function") console.error("[Admin ERROR] window." + fn + " no está definida.");
});

window.cancelVacationGroup = async (idx) => {
    const p = _visibleVacationPeriods[idx];
    if (!p) return;
    
    const count = p.ids ? p.ids.length : 1;
    const msg = count > 1 
        ? `Vas a anular ${p.days} días de vacaciones de ${p.empId} del ${window.fmtDateLegacy(p.start)} al ${window.fmtDateLegacy(p.end)}. ¿Continuar?`
        : `¿Anular las vacaciones de ${p.empId}?`;
        
    if (!confirm(msg)) return;
    
    try {
        const ids = p.ids || [p.id];
        for (const id of ids) {
            await window.TurnosDB.anularEvento(id);
        }
        await window.renderVacations();
    } catch (e) { alert('Error: ' + e.message); }
};

window.manageBajaGroup = async (id, ids) => {
    if (ids && ids.length > 1) {
        if (confirm(`Este periodo consta de ${ids.length} eventos diarios agrupados. ¿Deseas gestionar el periodo completo?\n\n(Pulsa Cancelar si prefieres gestionar solo el día inicial)`)) {
            // Por ahora, como no hay edición masiva, abrimos el primero pero avisamos
            window._editingGroupIds = ids;
        }
    }
    window.editBajaPeriod(id);
};

window.diagnoseOperationalOrder = (hotel, weekStart) => {
    const model = Object.values(window._previewPuestosModels || {}).find(m => m.hotel === hotel);
    if (!model) {
        console.warn("[DIAGNOSTIC] No hay modelo activo para", hotel);
        return;
    }

    const firstDate = model.dates[0] || weekStart;
    const baseRows = model.puestos.map(p => ({
        puestoOrden: p.rowIndex,
        titularBase: p.excelLabel,
        origenOrden: 'V9 Excel Map'
    }));

    const operationalRows = model.getEmployees().map(emp => ({
        puestoOrden: emp.puestoOrden,
        ocupanteVisible: emp.nombre,
        titularBase: emp.titularOriginal || emp.nombre,
        motivo: emp.isVacante ? 'Vacante' : (emp.isSustitucion ? 'Sustitucion' : (emp.isRefuerzo ? 'Refuerzo' : 'Titular Base')),
        origenOrden: 'Operativo Herencia'
    }));

    console.group('[DIAGNOSTICO OPERATIVO: ' + hotel + ' ' + firstDate + ']');
    console.log('--- baseRows ---');
    console.table(baseRows);
    console.log('--- operationalRows ---');
    console.table(operationalRows);
    console.groupEnd();
};
