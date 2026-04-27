const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const newRenderExcelView = `window.renderExcelView = async () => {
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

        // --- FETCH DATA ---
        const rawData = await window.TurnosDB.fetchTurnosBase(wStartStr, wEndStr, selectedHotel);
        let dbHotels = await window.TurnosDB.getHotels();
        if (!dbHotels || dbHotels.length === 0) dbHotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

        // --- FILTERS STATE ---
        if (!window.excelFilters) {
            window.excelFilters = { search: '', onlyPending: false };
        }
        if (window.pendingChangesCount === undefined) window.pendingChangesCount = 0;

        const getEmpLabel = (empId) => {
            if (!empId) return 'Desconocido';
            const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empId) || window.normalizeId(e.nombre) === window.normalizeId(empId));
            if (!profile) return \`\${empId} [\${empId}]\`;
            const idInt = profile.id_interno || profile.id || empId;
            return \`\${profile.nombre || empId} [\${idInt}]\`;
        };

        const TURNO_MAP = {
            'M': 'Mañana', 'Mañana': 'Mañana',
            'T': 'Tarde', 'Tarde': 'Tarde',
            'N': 'Noche', 'Noche': 'Noche',
            'D': 'Descanso', 'Descanso': 'Descanso',
            '-': 'Pendiente de asignar',
            '—': 'Pendiente de asignar',
            '': 'Pendiente de asignar',
            null: 'Pendiente de asignar'
        };

        // --- GROUPING & COUNTERS ---
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

            // Apply Filters
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

        // Solo pendientes filter
        if (window.excelFilters.onlyPending) {
            Object.keys(grouped).forEach(h => {
                Object.keys(grouped[h]).forEach(w => {
                    Object.keys(grouped[h][w]).forEach(e => {
                        if (!grouped[h][w][e].hasPending) delete grouped[h][w][e];
                    });
                    if (Object.keys(grouped[h][w]).length === 0) delete grouped[h][w];
                });
                if (Object.keys(grouped[h]).length === 0) delete grouped[h];
            });
        }

        // --- RENDER TOOLBAR ---
        const hotelsToRender = selectedHotel === 'all' ? dbHotels : [selectedHotel];
        const saveBtnActive = window.pendingChangesCount > 0;

        container.innerHTML = \`
            <div class="excel-toolbar">
                <div class="toolbar-group">
                    <label>Hotel</label>
                    <select id="excelHotel" class="toolbar-input" onchange="window.renderExcelView()">
                        <option value="all">Ver Todos</option>
                        \${dbHotels.map(h => \`<option value="\${escapeHtml(h)}" \${h === selectedHotel ? 'selected' : ''}>\${escapeHtml(h)}</option>\`).join('')}
                    </select>
                </div>
                <div class="toolbar-group">
                    <label>Mes</label>
                    <input type="month" id="excelMonth" class="toolbar-input" value="\${selectedMonth}" onchange="window.renderExcelView()">
                </div>
                <div class="toolbar-group">
                    <label>Empleado / ID</label>
                    <input type="text" id="excelSearch" class="toolbar-input" placeholder="Nombre o EMP-..." value="\${escapeHtml(window.excelFilters.search)}" 
                        oninput="window.excelFilters.search=this.value; window.renderExcelView()">
                </div>
                <div class="toolbar-group">
                    <label>Filtro Rápido</label>
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.8rem; text-transform:none; color:#1e293b; font-weight:600;">
                        <input type="checkbox" id="excelOnlyPending" \${window.excelFilters.onlyPending ? 'checked' : ''} 
                            onchange="window.excelFilters.onlyPending=this.checked; window.renderExcelView()"> Solo Pendientes
                    </label>
                </div>
                <div class="toolbar-group" style="margin-left:auto; text-align:right;">
                    <label>Pendientes</label>
                    <div style="font-weight:900; color:#b91c1c; font-size:1.1rem;">
                        <span id="excelCounter">\${totalPendientes}</span>
                    </div>
                </div>
                <button id="btnGuardarBase" 
                        class="btn-save-base \${saveBtnActive ? 'active' : ''}" 
                        \${!saveBtnActive ? 'disabled' : ''} 
                        onclick="window.saveTurnosBaseDirect()"
                        title="\${!saveBtnActive ? 'No hay cambios pendientes' : 'Guardar todos los cambios realizados'}">
                    <i class="fas fa-save"></i> 
                    \${saveBtnActive ? \`Guardar cambios (\${window.pendingChangesCount})\` : 'Guardar base'}
                </button>
            </div>
        \`;

        // --- RENDER TABLE ---
        const sections = hotelsToRender.map(hotel => {
            const hotelData = grouped[hotel];
            if (!hotelData) return '';

            const rows = [];
            Object.keys(hotelData).sort().forEach(wStart => {
                Object.keys(hotelData[wStart]).sort().forEach(emp => {
                    rows.push({
                        weekStart: wStart,
                        empId: emp,
                        displayName: getEmpLabel(emp),
                        values: hotelData[wStart][emp].values,
                        hotel: hotel
                    });
                });
            });

            if (rows.length === 0) return '';

            return \`
                <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; margin-bottom:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="padding:16px 20px; font-weight:800; color:#1e293b; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between;">
                        <span>\${escapeHtml(hotel)}</span>
                        <span style="font-size:0.7rem; color:#64748b; font-weight:600;">MOSTRANDO \${rows.length} FILAS</span>
                    </div>
                    <div style="overflow:auto;">
                        <table style="width:100%; border-collapse:collapse; min-width:980px;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:left; font-size:0.7rem; color:#64748b; text-transform:uppercase;">Semana</th>
                                    <th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:left; font-size:0.7rem; color:#64748b; text-transform:uppercase;">Empleado</th>
                                    \${['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map(day => \`<th style="padding:12px 8px; border-bottom:1px solid #e2e8f0; text-align:center; font-size:0.7rem; color:#64748b;">\${day}</th>\`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                \${rows.map(row => \`
                                    <tr class="excel-row-hover">
                                        <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap; color:#64748b; font-size:0.8rem;">\${escapeHtml(window.fmtDateLegacy(row.weekStart))}</td>
                                        <td style="padding:12px; border-bottom:1px solid #f1f5f9; min-width:220px; font-weight:600; color:#334155; font-size:0.85rem;">
                                            \${escapeHtml(row.displayName)}
                                        </td>
                                        \${[0, 1, 2, 3, 4, 5, 6].map(offset => {
                                            const dbVal = row.values[offset];
                                            const mappedVal = TURNO_MAP[dbVal] || dbVal;
                                            const isPendiente = (mappedVal === 'Pendiente de asignar');
                                            
                                            const options = ['Pendiente de asignar', 'Mañana', 'Tarde', 'Noche', 'Descanso'].map(o => {
                                                return \`<option value="\${escapeHtml(o)}" \${o === mappedVal ? 'selected' : ''}>\${escapeHtml(o)}</option>\`;
                                            }).join('');

                                            const currDate = new Date(row.weekStart);
                                            currDate.setDate(currDate.getDate() + offset);
                                            const dStr = window.isoDate(currDate);
                                            
                                            return \`
                                            <td style="padding:6px; border-bottom:1px solid #f1f5f9; text-align:center;">
                                                <select class="turno-edit-select \${isPendiente ? 'turno-pendiente-alerta' : ''}" 
                                                    data-hotel="\${escapeHtml(row.hotel)}" 
                                                    data-emp="\${escapeHtml(row.empId)}" 
                                                    data-date="\${dStr}" 
                                                    data-original="\${escapeHtml(dbVal)}" 
                                                    style="width:110px; padding:6px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; text-align:center; color:#475569; font-size:0.8rem; cursor:pointer;"
                                                    onchange="window.handleExcelCellChange(this)">
                                                    \${options}
                                                </select>
                                            </td>\`;
                                        }).join('')}
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            \`;
        }).join('');

        container.innerHTML += sections || '<div style="padding: 3rem; text-align: center; color: #94a3b8; font-weight:600;">No hay registros que coincidan con los filtros.</div>';
    } catch (error) {
        container.innerHTML = \`<div style="padding:2rem; color:red; font-weight:800;">Error cargando Modo Excel: \${escapeHtml(error.message)}</div>\`;
    }
};

window.handleExcelCellChange = (sel) => {
    // 1. Toggle Alerta
    const isPendiente = sel.value === 'Pendiente de asignar';
    sel.classList.toggle('turno-pendiente-alerta', isPendiente);

    // 2. Calcular cambios totales
    const selects = document.querySelectorAll('.turno-edit-select');
    let changes = 0;
    const REVERSE_MAP = { 'Mañana': 'M', 'Tarde': 'T', 'Noche': 'N', 'Descanso': 'D', 'Pendiente de asignar': '—' };
    
    selects.forEach(s => {
        const currentDb = REVERSE_MAP[s.value] || s.value;
        if (s.dataset.original !== currentDb) changes++;
    });

    window.pendingChangesCount = changes;

    // 3. Update Button
    const btn = document.getElementById('btnGuardarBase');
    if (btn) {
        btn.disabled = changes === 0;
        btn.classList.toggle('active', changes > 0);
        btn.innerHTML = \`<i class="fas fa-save"></i> \${changes > 0 ? \`Guardar cambios (\${changes})\` : 'Guardar base'}\`;
        btn.title = changes === 0 ? 'No hay cambios pendientes' : 'Guardar todos los cambios realizados';
    }

    // 4. Update Pending Counter (Global)
    const counter = document.getElementById('excelCounter');
    if (counter) {
        let totalP = 0;
        selects.forEach(s => { if (s.value === 'Pendiente de asignar') totalP++; });
        counter.textContent = totalP;
    }
};

window.saveTurnosBaseDirect = async () => {
    const btn = document.getElementById('btnGuardarBase');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }
    try {
        const selects = document.querySelectorAll('select.turno-edit-select');
        const updates = [];
        const REVERSE_MAP = { 'Mañana': 'M', 'Tarde': 'T', 'Noche': 'N', 'Descanso': 'D', 'Pendiente de asignar': '—' };

        selects.forEach(sel => {
            const original = sel.dataset.original;
            const currentVis = sel.value;
            const currentDb = REVERSE_MAP[currentVis] || currentVis;
            if (original !== currentDb) {
                updates.push({
                    hotel_id: sel.dataset.hotel,
                    empleado_id: sel.dataset.emp,
                    fecha: sel.dataset.date,
                    turno: currentDb,
                    updated_by: 'ADMIN_EXCEL_VIEW'
                });
            }
        });

        if (updates.length === 0) {
            alert('No hay cambios que guardar.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Guardar base';
            }
            return;
        }

        const client = window.supabase;
        const { error } = await client.from('turnos').upsert(updates, { onConflict: 'empleado_id,fecha' });
        if (error) throw error;
        
        window.pendingChangesCount = 0;
        alert('✅ Cambios base guardados correctamente.');
        await window.renderExcelView();
    } catch (err) {
        console.error(err);
        alert('❌ Error al guardar: ' + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
        }
    }
};`;

// We need to replace from 'window.renderExcelView = async () => {' to the end of 'window.saveTurnosBaseDirect = async () => { ... };'
// I'll look for the start and end indices.

const startMarker = 'window.renderExcelView = async () => {';
const endMarker = 'window.saveTurnosBaseDirect = async () => {';

// Since saveTurnosBaseDirect is followed by other things, I'll find where it ends.
// Looking at the view_file, saveTurnosBaseDirect ends around 1623.

// Actually, I'll just replace a huge block using a marker after saveTurnosBaseDirect.
const contentToReplaceStart = content.indexOf(startMarker);
const nextMarker = 'window.toggleTheme = () => {';
const contentToReplaceEnd = content.indexOf(nextMarker);

if (contentToReplaceStart !== -1 && contentToReplaceEnd !== -1) {
    const newContent = content.substring(0, contentToReplaceStart) + newRenderExcelView + '\n\n' + content.substring(contentToReplaceEnd);
    fs.writeFileSync(path, newContent, 'utf8');
    console.log('Successfully upgraded admin.js');
} else {
    console.log('Markers not found');
}
