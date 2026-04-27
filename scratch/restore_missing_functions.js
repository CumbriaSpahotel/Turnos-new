const fs = require('fs');
const path = require('path');

const adminJsPath = path.resolve(__dirname, '../admin.js');
let content = fs.readFileSync(adminJsPath, 'utf8');

// Definiciones a inyectar
const missingFunctions = `
// ==========================================
// MÓDULO: MODO EXCEL (RESTAURADO)
// ==========================================
window.renderExcelView = async () => {
    const container = $('#excel-grid-container');
    if (!container) return;
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-dim);">Cargando Excel base...</div>';
    try {
        const hotelSelect = $('#excelHotel');
        const monthInput = $('#excelMonth');
        const selectedHotel = hotelSelect?.value || 'all';
        if (monthInput && !monthInput.value) monthInput.value = window.isoDate(new Date()).slice(0, 7);
        const selectedMonth = monthInput?.value || window.isoDate(new Date()).slice(0, 7);
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthStart = \`\${selectedMonth}-01\`;
        const monthEnd = window.isoDate(new Date(year, month, 0));
        const wStartStr = window.getWeekStartISO(monthStart);
        const wEndTemp = new Date(monthEnd);
        const dEnd = wEndTemp.getDay();
        const diff = dEnd === 0 ? 0 : 7 - dEnd;
        wEndTemp.setDate(wEndTemp.getDate() + diff);
        const wEndStr = window.isoDate(wEndTemp);
        const rawData = await window.TurnosDB.fetchTurnosBase(wStartStr, wEndStr, selectedHotel);
        let dbHotels = await window.TurnosDB.getHotels();
        if (!dbHotels || dbHotels.length === 0) dbHotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
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
        rawData.forEach(record => {
            const empId = record.empleado_id || 'Desconocido';
            if (empId.startsWith('_DUP')) return;
            const h = record.hotel_id || 'Sin Hotel';
            if (selectedHotel !== 'all' && h !== selectedHotel) return;
            const wStart = window.getWeekStartISO(record.fecha);
            const val = record.turno || '—';
            if (val === '—' || val === '-' || !val) totalPendientes++;
            const label = getEmpLabel(empId).toLowerCase();
            const searchMatch = !window.excelFilters.search || label.includes(window.excelFilters.search.toLowerCase());
            if (!searchMatch) return;
            if (!grouped[h]) grouped[h] = {};
            if (!grouped[h][wStart]) grouped[h][wStart] = {};
            if (!grouped[h][wStart][empId]) grouped[h][wStart][empId] = { values: Array(7).fill('—'), hasPending: false };
            const offset = window.getDayOffsetFromWeek(wStart, record.fecha);
            if (offset >= 0 && offset <= 6) {
                grouped[h][wStart][empId].values[offset] = val;
                if (val === '—' || val === '-' || !val) grouped[h][wStart][empId].hasPending = true;
            }
        });
        if (window.excelFilters.onlyPending) {
            Object.keys(grouped).forEach(h => {
                Object.keys(grouped[h]).forEach(w => {
                    Object.keys(grouped[h][w]).forEach(e => { if (!grouped[h][w][e].hasPending) delete grouped[h][w][e]; });
                    if (Object.keys(grouped[h][w]).length === 0) delete grouped[h][w];
                });
                if (Object.keys(grouped[h]).length === 0) delete grouped[h];
            });
        }
        const hotelsToRender = selectedHotel === 'all' ? dbHotels : [selectedHotel];
        const saveBtnActive = window.pendingChangesCount > 0;
        container.innerHTML = \`
            <div class="excel-toolbar">
                <div class="toolbar-group"><label>Hotel</label><select id="excelHotel" class="toolbar-input" onchange="window.renderExcelView()"><option value="all">Ver Todos</option>\${dbHotels.map(h => \`<option value="\${h}" \${h === selectedHotel ? 'selected' : ''}>\${h}</option>\`).join('')}</select></div>
                <div class="toolbar-group"><label>Mes</label><input type="month" id="excelMonth" class="toolbar-input" value="\${selectedMonth}" onchange="window.renderExcelView()"></div>
                <div class="toolbar-group"><label>Empleado / ID</label><input type="text" id="excelSearch" class="toolbar-input" placeholder="Nombre o EMP-..." value="\${window.excelFilters.search}" oninput="window.excelFilters.search=this.value; window.renderExcelView()"></div>
                <div class="toolbar-group"><label>Filtro Rápido</label><label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.8rem; text-transform:none; color:#1e293b; font-weight:600;"><input type="checkbox" id="excelOnlyPending" \${window.excelFilters.onlyPending ? 'checked' : ''} onchange="window.excelFilters.onlyPending=this.checked; window.renderExcelView()"> Solo Pendientes</label></div>
                <div class="toolbar-group" style="margin-left:auto; text-align:right;"><label>Pendientes</label><div style="font-weight:900; color:#b91c1c; font-size:1.1rem;"><span id="excelCounter">\${totalPendientes}</span></div></div>
                <button id="btnGuardarBase" class="btn-save-base \${saveBtnActive ? 'active' : ''}" \${!saveBtnActive ? 'disabled' : ''} onclick="window.saveTurnosBaseDirect()" title="\${!saveBtnActive ? 'No hay cambios pendientes' : 'Guardar todos los cambios realizados'}"><i class="fas fa-save"></i> \${saveBtnActive ? \`Guardar cambios (\${window.pendingChangesCount})\` : 'Guardar base'}</button>
            </div>
        \`;
        const sections = hotelsToRender.map(hotel => {
            const hotelData = grouped[hotel];
            if (!hotelData) return '';
            const rows = [];
            Object.keys(hotelData).sort().forEach(wStart => { Object.keys(hotelData[wStart]).sort().forEach(emp => { rows.push({ weekStart: wStart, empId: emp, displayName: getEmpLabel(emp), values: hotelData[wStart][emp].values, hotel: hotel }); }); });
            if (rows.length === 0) return '';
            return \`
                <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; margin-bottom:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="padding:16px 20px; font-weight:800; color:#1e293b; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between;"><span>\${hotel}</span><span style="font-size:0.7rem; color:#64748b; font-weight:600;">MOSTRANDO \${rows.length} FILAS</span></div>
                    <div style="overflow:auto;"><table style="width:100%; border-collapse:collapse; min-width:980px;"><thead><tr style="background:#f8fafc;"><th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:left; font-size:0.7rem; color:#64748b; text-transform:uppercase;">Semana</th><th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:left; font-size:0.7rem; color:#64748b; text-transform:uppercase;">Empleado</th>\${['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map(day => \`<th style="padding:12px 8px; border-bottom:1px solid #e2e8f0; text-align:center; font-size:0.7rem; color:#64748b;">\${day}</th>\`).join('')}</tr></thead><tbody>\${rows.map(row => \`
                                    <tr class="excel-row-hover"><td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap; color:#64748b; font-size:0.8rem;">\${window.fmtDateLegacy(row.weekStart)}</td><td style="padding:12px; border-bottom:1px solid #f1f5f9; min-width:220px; font-weight:600; color:#334155; font-size:0.85rem;">\${row.displayName}</td>\${[0, 1, 2, 3, 4, 5, 6].map(offset => {
                                            const dbVal = row.values[offset];
                                            const mappedVal = TURNO_MAP[dbVal] || dbVal;
                                            const isPendiente = (mappedVal === 'Pendiente de asignar');
                                            const options = ['Pendiente de asignar', 'Mañana', 'Tarde', 'Noche', 'Descanso'].map(o => \`<option value="\${o}" \${o === mappedVal ? 'selected' : ''}>\${o}</option>\`).join('');
                                            const currDate = new Date(row.weekStart); currDate.setDate(currDate.getDate() + offset);
                                            const dStr = window.isoDate(currDate);
                                            return \`<td style="padding:6px; border-bottom:1px solid #f1f5f9; text-align:center;"><select class="turno-edit-select \${isPendiente ? 'turno-pendiente-alerta' : ''}" data-hotel="\${row.hotel}" data-emp="\${row.empId}" data-date="\${dStr}" data-original="\${dbVal}" style="width:110px; padding:6px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; text-align:center; color:#475569; font-size:0.8rem; cursor:pointer;" onchange="window.handleExcelCellChange(this)">\${options}</select></td>\`;
                                        }).join('')}</tr>\`).join('')}</tbody></table></div></div>\`;
        }).join('');
        container.innerHTML += sections || '<div style="padding: 3rem; text-align: center; color: #94a3b8; font-weight:600;">No hay registros que coincidan con los filtros.</div>';
    } catch (error) { container.innerHTML = \`<div style="padding:2rem; color:red; font-weight:800;">Error cargando Modo Excel: \${error.message}</div>\`; }
};

window.handleExcelCellChange = (sel) => {
    const isPendiente = sel.value === 'Pendiente de asignar';
    sel.classList.toggle('turno-pendiente-alerta', isPendiente);
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
        btn.innerHTML = \`<i class="fas fa-save"></i> \${changes > 0 ? \`Guardar cambios (\${changes})\` : 'Guardar base'}\`;
    }
};

window.saveTurnosBaseDirect = async () => {
    const btn = document.getElementById('btnGuardarBase');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; }
    try {
        const selects = document.querySelectorAll('select.turno-edit-select');
        const updates = [];
        const REVERSE_MAP = { 'Mañana': 'M', 'Tarde': 'T', 'Noche': 'N', 'Descanso': 'D', 'Pendiente de asignar': '—' };
        selects.forEach(sel => {
            const original = sel.dataset.original;
            const currentDb = REVERSE_MAP[sel.value] || sel.value;
            if (original !== currentDb) { updates.push({ hotel_id: sel.dataset.hotel, empleado_id: sel.dataset.emp, fecha: sel.dataset.date, turno: currentDb, updated_by: 'ADMIN_EXCEL_VIEW' }); }
        });
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
// MÓDULO: SOLICITUDES (RESTAURADO)
// ==========================================
window.renderRequests = async () => {
    const container = $('#changes-content');
    if (!container) return;
    container.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando solicitudes...</div>';
    try {
        const data = await window.TurnosDB.fetchPeticiones();
        const filtered = data.filter(r => r.estado === 'pendiente');
        if (filtered.length === 0) {
            container.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;">No hay solicitudes pendientes.</div>';
            return;
        }
        container.innerHTML = filtered.map(req => \`
            <div class="request-card-admin" style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); border-left:6px solid #f59e0b;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-size:0.7rem; font-weight:800; color:#0ea5e9; text-transform:uppercase;">\${req.hotel}</div>
                        <h3 style="font-size:1.1rem; font-weight:800; margin:4px 0;">\${req.solicitante} \${req.companero ? '& ' + req.companero : ''}</h3>
                        <div style="font-size:0.8rem; color:#64748b;">Solicitado el \${new Date(req.created_at).toLocaleString()}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.handleRequestAction('\${req.id}', 'rechazada')" style="background:#fee2e2; color:#991b1b; border:none; padding:8px 16px; border-radius:8px; font-weight:700; cursor:pointer;">Denegar</button>
                        <button onclick="window.handleRequestAction('\${req.id}', 'aprobada')" style="background:#dcfce7; color:#166534; border:none; padding:8px 16px; border-radius:8px; font-weight:700; cursor:pointer;">Aprobar</button>
                    </div>
                </div>
                <div style="margin-top:16px; display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
                    \${(req.fechas || []).map(f => \`
                        <div style="background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0;">
                            <div style="font-weight:800; font-size:0.85rem;">\${f.fecha}</div>
                            <div style="font-size:0.8rem; color:#64748b;">\${f.origen} → \${f.destino}</div>
                        </div>
                    \`).join('')}
                </div>
            </div>
        \`).join('');
    } catch (e) { container.innerHTML = '<div style="color:red;">Error: ' + e.message + '</div>'; }
};

window.handleRequestAction = async (id, newState) => {
    if (!confirm(\`¿Estás seguro de marcar como \${newState}?\`)) return;
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
    const current = new Date(\`\${window._employeeProfileDate || window.isoDate(new Date())}T12:00:00\`);
    current.setMonth(current.getMonth() + direction);
    window._employeeProfileDate = window.isoDate(current);
    window.renderEmployeeProfile();
};

window.saveEmployeeProfileInline = async () => {
    const empId = window._employeeProfileId;
    if (!empId) return;
    const nombre = $('#edit-emp-nombre')?.value;
    const hotel = $('#edit-emp-hotel')?.value;
    const estado = $('#edit-emp-estado')?.value;
    
    try {
        const { error } = await window.supabase.from('empleados').update({
            nombre, hotel_id: hotel, estado
        }).eq('id', empId);
        if (error) throw error;
        alert('Ficha actualizada correctamente.');
        await window.populateEmployees();
        window.renderEmployeeProfile();
    } catch (e) { alert('Error al guardar: ' + e.message); }
};
`;

// Insertamos después de switchSection (aprox línea 41)
const switchSectionEnd = content.indexOf('};', content.indexOf('window.switchSection = (id) => {')) + 2;

if (switchSectionEnd > 2) {
    const newContent = content.slice(0, switchSectionEnd) + missingFunctions + content.slice(switchSectionEnd);
    fs.writeFileSync(adminJsPath, newContent, 'utf8');
    console.log('Funciones restauradas quirúrgicamente.');
} else {
    console.error('No se pudo encontrar el punto de inserción para switchSection.');
}
