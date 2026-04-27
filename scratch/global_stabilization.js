const fs = require('fs');

const jsPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

// 1. RESTAURAR UTILIDADES GLOBALES (Al inicio del archivo)
const utilitiesBlock = `// --- UTILIDADES GLOBALES ---
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => document.querySelectorAll(s);
const $ = window.$;
const $$ = window.$$;

window.safeGet = (id) => document.getElementById(id) || { textContent: '', style: {}, innerHTML: '', value: '' };

window.isoDate = (date) => {
    if (!date) return null;
    const d = (typeof date === 'string') ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return \`\${y}-\${m}-\${day}\`;
};

window.fmtDateLegacy = (dateStr) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return \`\${parts[2]}/\${parts[1]}/\${parts[0].slice(2)}\`;
};

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
    console.log(\`[\${type.toUpperCase()}] \${msg}\`);
    const timeline = document.getElementById('dashboard-timeline');
    if (timeline) {
        const item = document.createElement('div');
        item.className = \`activity-log-item \${type}\`;
        item.style = 'padding: 10px 20px; border-bottom: 1px solid #eee; font-size: 0.8rem;';
        item.innerHTML = \`<strong>\${new Date().toLocaleTimeString()}</strong> \${msg}\`;
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
`;

// Reemplazar el bloque de utilidades actual (si existe)
const utilPattern = /\/\/ --- UTILIDADES GLOBALES ---[\s\S]*?\/\/ --- FIX DATA/;
if (utilPattern.test(js)) {
    js = js.replace(utilPattern, utilitiesBlock + '\n\n// --- FIX DATA');
} else {
    // Si no se encuentra el marcador, insertar al principio
    js = utilitiesBlock + '\n' + js;
}

// 2. CORREGIR MODO EXCEL (dbHotels y rawData)
const excelRenderPattern = /window\.renderExcelView = async \(\) => \{[\s\S]*?rawData\.forEach\(record => \{/;
const excelRenderFix = `window.renderExcelView = async () => {
    const container = $('#excel-grid-container');
    if (!container) return;
    
    const oldHotelSelect = $('#excelHotel');
    const oldDateStart = $('#excelDateStart')?.value;
    const oldDateEnd = $('#excelDateEnd')?.value;
    const selectedHotel = oldHotelSelect?.value || 'all';

    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-dim);"><i class="fas fa-spinner fa-spin"></i> Cargando Excel base...</div>';
    
    try {
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
        if (window.pendingChangesCount === undefined) window.pendingChangesCount = 0;
        
        const getEmpLabel = (empId) => {
            if (!empId) return 'Desconocido';
            const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empId) || window.normalizeId(e.nombre) === window.normalizeId(empId));
            if (!profile) return \`\${empId} [\${empId}]\`;
            const idInt = profile.id_interno || profile.id || empId;
            return \`\${profile.nombre || empId} [\${idInt}]\`;
        };
        const TURNO_MAP = { 'M': 'Mañana', 'Mañana': 'Mañana', 'T': 'Tarde', 'Tarde': 'Tarde', 'N': 'Noche', 'Noche': 'Noche', 'D': 'Descanso', 'Descanso': 'Descanso', '-': 'Pendiente de asignar', '—': 'Pendiente de asignar', '': 'Pendiente de asignar', null: 'Pendiente de asignar' };
        let totalPendientes = 0;
        const grouped = {};
        rawData.forEach(record => {`;

js = js.replace(excelRenderPattern, excelRenderFix);

// 3. NAVEGACIÓN GLOBAL (switchSection con ALIAS)
const navBlock = `window.switchSection = (id) => {
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

    console.log(\`[NAV] Cambiando a sección: \${targetId} (original: \${id})\`);
    const sections = document.querySelectorAll('.section');
    const menuItems = document.querySelectorAll('.menu-item');
    
    sections.forEach(s => s.classList.remove('active'));
    menuItems.forEach(m => m.classList.remove('active'));

    const targetSec = document.getElementById(\`section-\${targetId}\`);
    if (targetSec) {
        targetSec.classList.add('active');
    } else {
        console.warn(\`[NAV] Sección section-\${targetId} no encontrada en el DOM\`);
    }

    // Activar el botón correspondiente en el sidebar
    const targetBtn = Array.from(menuItems).find(m => {
        const onClick = m.getAttribute('onclick') || '';
        return onClick.includes(\`'\${id}'\`) || onClick.includes(\`"\${id}"\`) || onClick.includes(\`'\${targetId}'\`) || onClick.includes(\`"\${targetId}"\`);
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
};`;

const navPattern = /window\.switchSection = \(id\) => \{[\s\S]*?\};/;
js = js.replace(navPattern, navBlock);

// 4. BAJAS SELECT OPTIONS FIX
const bajasOptionsFix = `// Llenar filtros del header si existen
        const hotelSelect = $('#bjHotel');
        const empSelect = $('#bjEmp');
        if (hotelSelect && empSelect && hotelSelect.options.length <= 1) {
            const [hotels, employees] = await Promise.all([window.TurnosDB.getHotels(), window.TurnosDB.getEmpleados()]);
            hotelSelect.innerHTML = \`<option value="all">Todos los Hoteles</option>\` + hotels.map(h => \`<option value="\${h}">\${h}</option>\`).join('');
            empSelect.innerHTML = \`<option value="all">Todos los Empleados</option>\` + employees.map(e => \`<option value="\${e.id}">\${e.nombre || e.id}</option>\`).join('');
`;
const bajasOptionsPattern = /\/\/ Llenar filtros del header si es la primera vez o están vacíos[\s\S]*?employees\.map\(e => `<option value="\${e\.id}">\${e\.nombre \|\| e\.id}<\/option>`\)\.join\(''\);/;
js = js.replace(bajasOptionsPattern, bajasOptionsFix);

// 5. DASHBOARD QUICK ACTIONS (Añadir al final de renderDashboard)
const dashboardQuickActions = `
        // --- BLOQUE E: ACCIONES RÁPIDAS ---
        const quickActions = $('#dashboard-quick-actions');
        if (quickActions) {
            quickActions.innerHTML = \`
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:15px;">
                    <button class="btn-premium" onclick="window.switchSection('excel')" style="height:100px; flex-direction:column; gap:8px;"><i class="fas fa-file-excel fa-2x"></i><span>Gestión Excel</span></button>
                    <button class="btn-premium" onclick="window.switchSection('preview')" style="height:100px; flex-direction:column; gap:8px;"><i class="fas fa-calendar-alt fa-2x"></i><span>Vista Previa</span></button>
                    <button class="btn-premium" onclick="window.switchSection('employees')" style="height:100px; flex-direction:column; gap:8px;"><i class="fas fa-users fa-2x"></i><span>Empleados</span></button>
                    <button class="btn-premium" onclick="window.open('https://cumbriaspahotel.github.io/Turnos-new/', '_blank', 'noopener,noreferrer')" style="height:100px; flex-direction:column; gap:8px; background:var(--accent); color:white;"><i class="fas fa-external-link-alt fa-2x"></i><span>Vista Pública</span></button>
                </div>
            \`;
        }
    } catch (err) {`;

js = js.replace('} catch (err) {', dashboardQuickActions);

fs.writeFileSync(jsPath, js);
console.log("admin.js stabilized.");
