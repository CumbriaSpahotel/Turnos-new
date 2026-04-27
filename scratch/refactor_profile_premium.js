const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const newRenderProfile = `
window.renderEmployeeProfile = () => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    if (!drawer || !body) return;

    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    if (!model) return;
    
    drawer.classList.add('open');
    const emp = model.empleado;
    const refISO = window._employeeProfileDate || window.isoDate(new Date());
    const refDate = new Date(\`\${refISO}T12:00:00\`);
    const titlePeriod = refDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const currentTab = window._employeeProfileTab || 'overview';

    // 1. CABECERA PREMIUM
    const headerHTML = \`
        <div class="emp-premium-header">
            <div class="emp-header-info">
                <div class="emp-avatar">\${emp.nombre.charAt(0)}</div>
                <div class="emp-title-block">
                    <h2>\${escapeHtml(emp.nombre)} <span>\${emp.id_interno || 'SIN ID'}</span></h2>
                    <div class="emp-subtitle">
                        \${emp.puesto || 'Puesto no definido'} <i class="fas fa-circle"></i> 
                        \${emp.hotel || 'Hotel no definido'} <i class="fas fa-circle"></i> 
                        <span style="color: \${emp.estado === 'Activo' ? '#10b981' : '#ef4444'}; font-weight:700;">\${emp.estado || 'Activo'}</span>
                    </div>
                </div>
            </div>
            <div class="emp-header-actions">
                <button class="btn-premium" onclick="window.enableEmployeeProfileEdit()" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:10px;">
                    <i class="fas fa-edit"></i> Editar ficha
                </button>
            </div>
        </div>
    \`;

    // 2. RESUMEN KPI
    const kpiHTML = \`
        <div class="emp-kpi-grid">
            <div class="emp-kpi-card">
                <label>Estado Hoy</label>
                <strong>\${window.employeeShiftLabel ? window.employeeShiftLabel(model.hoy) : '-'}</strong>
            </div>
            <div class="emp-kpi-card">
                <label>Hotel Actual</label>
                <strong>\${emp.hotel || '-'}</strong>
            </div>
            <div class="emp-kpi-card">
                <label>Saldo Vacaciones</label>
                <strong style="color:\${model.vacaciones.saldo < 0 ? '#ef4444' : '#10b981'};">\${model.vacaciones.saldo} d&iacute;as</strong>
            </div>
            <div class="emp-kpi-card">
                <label>Vacas. Usadas</label>
                <strong>\${model.vacaciones.usadas} / \${model.vacaciones.derechoAnual}</strong>
            </div>
            <div class="emp-kpi-card">
                <label>Cambios Mes</label>
                <strong>\${model.eventosActivos.filter(e => e.tipo === 'CAMBIO').length}</strong>
            </div>
        </div>
    \`;

    const tabsNav = \`
        <div class="emp-tabs-nav">
            <button class="emp-tab-btn \${currentTab === 'overview' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('overview')">Vista General</button>
            <button class="emp-tab-btn \${currentTab === 'planning' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('planning')">Planificaci&oacute;n</button>
            <button class="emp-tab-btn \${currentTab === 'config' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('config')">Datos y Config</button>
            <button class="emp-tab-btn \${currentTab === 'history' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('history')">Historial</button>
            <button class="emp-tab-btn \${currentTab === 'vacations' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('vacations')">Control Vacaciones</button>
        </div>
    \`;

    let tabContent = '';
    if (currentTab === 'overview') {
        tabContent = \`
            <div class="emp-grid">
                <div class="span-8">
                    <section class="emp-card">
                        <h3 style="font-size:0.9rem; font-weight:800; color:#334155; margin-bottom:16px;">Pr&oacute;ximos Eventos</h3>
                        \${model.eventosActivos.length > 0 ? model.eventosActivos.slice(0, 5).map(ev => \`
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:12px; margin-bottom:8px; border-left:4px solid \${ev.tipo === 'VAC' ? '#2563eb' : '#ef4444'};">
                                <div>
                                    <div style="font-weight:800; font-size:0.85rem; color:#1e293b;">\${ev.tipo}</div>
                                    <div style="font-size:0.75rem; color:#64748b;">\${window.fmtDateLegacy(ev.fecha_inicio)}</div>
                                </div>
                                <div style="font-size:0.7rem; font-weight:700; color:#94a3b8;">\${ev.tipo}</div>
                            </div>
                        \`).join('') : '<div style="padding:40px; text-align:center; opacity:0.5; font-size:0.8rem;">No hay eventos pr&oacute;ximos registrados.</div>'}
                    </section>
                </div>
                <div class="span-4">
                    <section class="emp-card">
                        <h3 style="font-size:0.9rem; font-weight:800; color:#334155; margin-bottom:16px;">Navegaci&oacute;n</h3>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <button onclick="window.moveEmployeeProfilePeriod(-1)" class="btn-premium">Anterior</button>
                            <strong style="font-size:0.8rem;">\${titlePeriod}</strong>
                            <button onclick="window.moveEmployeeProfilePeriod(1)" class="btn-premium">Siguiente</button>
                        </div>
                    </section>
                </div>
            </div>
        \`;
    } else if (currentTab === 'config') {
        tabContent = \`
            <div class="emp-grid">
                <div class="span-6">
                    <div class="emp-profile-field"><label>Nombre</label><input type="text" id="edit-emp-nombre" value="\${emp.nombre || ''}"></div>
                    <div class="emp-profile-field"><label>Email</label><input type="email" id="edit-emp-email" value="\${emp.email || ''}"></div>
                    <div class="emp-profile-field"><label>Tel&eacute;fono</label><input type="text" id="edit-emp-telefono" value="\${emp.telefono || ''}"></div>
                </div>
                <div class="span-6">
                    <div class="emp-profile-field"><label>Hotel</label>
                        <select id="edit-emp-hotel">
                            <option value="Cumbria Spa&Hotel" \${emp.hotel === 'Cumbria Spa&Hotel' ? 'selected' : ''}>Cumbria Spa&Hotel</option>
                            <option value="Sercotel Guadiana" \${emp.hotel === 'Sercotel Guadiana' ? 'selected' : ''}>Sercotel Guadiana</option>
                        </select>
                    </div>
                    <div class="emp-profile-field"><label>Estado Laboral</label>
                        <select id="edit-emp-estado">
                            <option value="Activo" \${emp.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                            <option value="Baja" \${emp.estado === 'Baja' ? 'selected' : ''}>Baja</option>
                        </select>
                    </div>
                </div>
                <div class="span-12">
                    <button class="btn-publish-premium" onclick="window.saveEmployeeProfileInline()" style="width:auto; padding:12px 32px;">Guardar Cambios</button>
                </div>
            </div>
        \`;
    }

    body.innerHTML = \`
        <div class="employee-profile-container">
            \${headerHTML}
            \${kpiHTML}
            \${tabsNav}
            <div class="emp-content-area">
                \${tabContent}
                <details class="emp-legacy-section">
                    <summary>Informaci&oacute;n T&eacute;cnica</summary>
                    <pre>ID: \${emp.id}\\nUUID: \${emp.uuid}</pre>
                </details>
            </div>
        </div>
    \`;
};

window.buildEmployeeProfileModel = (empId, refISO) => {
    const emp = window.empleadosGlobales.find(e => e.id === empId || e.uuid === empId);
    if (!emp) return null;
    const refDate = new Date(\`\${refISO}T12:00:00\`);
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const calendario = window.employeeCalendarRange(refISO, 'month').map(fecha => {
        const dayInfo = window.resolveEmployeeDay(emp.id, fecha, window.eventosGlobales, window._lastRawTurnosBase);
        return { fecha, turno: dayInfo.turno, incidencia: dayInfo.incidencia, outsideMonth: new Date(\`\${fecha}T12:00:00\`).getMonth() !== month };
    });
    const hoy = calendario.find(d => d.fecha === window.isoDate(new Date())) || { fecha: window.isoDate(new Date()), turno: '-' };
    const eventosActivos = (window.eventosGlobales || []).filter(ev => ev.empleado_id === emp.id || ev.empleado_uuid === emp.uuid);
    const derechoAnual = parseInt(emp.vacaciones_derecho || 30);
    const usadas = eventosActivos.filter(ev => ev.tipo === 'VAC' && ev.fecha_inicio.startsWith(year)).length;
    const regularizacion = parseInt(emp.vacaciones_regularizacion || 0);
    const saldo = derechoAnual - usadas + regularizacion;
    return { empleado: emp, calendario, hoy, eventosActivos, vacaciones: { derechoAnual, usadas, saldo }, meta: { regularizacion } };
};

window.moveEmployeeProfilePeriod = (delta) => {
    const d = new Date(\`\${window._employeeProfileDate}T12:00:00\`);
    d.setMonth(d.getMonth() + delta);
    window._employeeProfileDate = window.isoDate(d);
    window.renderEmployeeProfile();
};

window.setEmployeeProfileTab = (tab) => {
    window._employeeProfileTab = tab;
    window.renderEmployeeProfile();
};

window.saveEmployeeProfileInline = async () => {
    const empId = window._employeeProfileId;
    const payload = {
        nombre: $('#edit-emp-nombre').value,
        email: $('#edit-emp-email').value,
        telefono: $('#edit-emp-telefono').value,
        hotel: $('#edit-emp-hotel').value,
        estado_empresa: $('#edit-emp-estado').value,
        activo: $('#edit-emp-estado').value === 'Activo',
        updated_at: new Date().toISOString()
    };
    try {
        await window.TurnosDB.updateEmpleado(empId, payload);
        const emp = window.empleadosGlobales.find(e => e.id === empId || e.uuid === empId);
        if (emp) { Object.assign(emp, payload); emp.estado = payload.estado_empresa; }
        alert('Perfil actualizado.');
        window.renderEmployeeProfile();
    } catch (err) {
        alert('Error al guardar: ' + err.message);
    }
};
`;

const startMarker = 'window.renderEmployeeProfile = () => {';
const endMarker = '// =========================================='; 
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex + 100);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = content.slice(0, startIndex) + newRenderProfile + content.slice(endIndex);
    fs.writeFileSync(path, newContent, 'utf8');
    console.log('Ficha de empleado refactorizada.');
} else {
    console.error('Marker not found.');
}
