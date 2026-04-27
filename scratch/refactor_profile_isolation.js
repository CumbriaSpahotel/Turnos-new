const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Refactor buildEmployeeProfileModel to be more robust
const newBuildModel = `window.buildEmployeeProfileModel = (empleadoId, fechaReferencia) => {
    const DEFAULT_CONDICIONES = {
        vacaciones: { derechoAnual: 44, generadas: 0, usadas: 0, regularizacion: 0, saldo: 0 },
        descansos: { esperados: 0, reales: 0, diferencia: 0 },
        meta: { regularizacion: 0 }
    };

    const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empleadoId) || window.normalizeId(e.nombre) === window.normalizeId(empleadoId));
    if (!profile) return null;

    const refISO = String(fechaReferencia || window.isoDate(new Date())).slice(0, 10);
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
        id_interno: profile.id_interno
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
            baseIndex
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
};`;

const newRenderProfile = `window.renderEmployeeProfile = () => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    if (!drawer || !body) return;

    // EL ESTADO ES INDEPENDIENTE DEL DASHBOARD
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    if (!model) return;
    
    drawer.classList.add('open');
    const emp = model.empleado;
    const refISO = window._employeeProfileDate || window.isoDate(new Date());
    const refDate = new Date(\`\${refISO}T12:00:00\`);
    const titlePeriod = refDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const currentTab = window._employeeProfileTab || 'overview';

    // DATOS COMPACTOS
    const laboralRows = [
        ['ID Interno', emp.id_interno, 'id_interno'],
        ['Nombre', emp.nombre, 'nombre'], 
        ['Hotel Principal', emp.hotel, 'hotel_id'],
        ['Puesto', emp.puesto, 'puesto'], 
        ['Tipo', emp.tipo, 'tipo_personal'], 
        ['Estado Laboral', emp.estado, 'estado_empresa']
    ];

    if (emp.estado === 'Baja') {
        laboralRows.push(['Fecha Baja', emp.fechaBaja, 'fecha_baja', 'date']);
    }

    const contactoRows = [
        ['Teléfono', emp.telefono, 'telefono'], 
        ['Email', emp.email, 'email']
    ];

    const incidenciasActivasRaw = model.eventosActivos.filter(ev => /VAC|BAJA|PERM/i.test(ev.tipo || ''));
    const incidenciasActivas = window.groupConsecutiveEvents(incidenciasActivasRaw);
    const cambiosActivos = model.eventosActivos.filter(ev => /CAMBIO|INTERCAMBIO|REFUERZO/i.test(ev.tipo || ''));

    const overviewContent = \`
        <div class="employee-profile-layout">
            <div class="employee-config-panel">
                <!-- ALERTAS JUSTIFICADAS -->
                \${(() => {
                    const showCounters = window.shouldShowEmployeeCounters && window.shouldShowEmployeeCounters(model.empleado);
                    const alerts = [];
                    if (showCounters) {
                        let consecutive = 0; let maxConsecutive = 0;
                        const isWorking = (d) => {
                            const t = (d.turno || '').toUpperCase();
                            if (d.incidencia) return false;
                            if (['D', 'DESCANSO', '-', '—', '', 'PENDIENTE DE ASIGNAR'].includes(t)) return false;
                            return ['M', 'T', 'N', 'MAÑANA', 'TARDE', 'NOCHE'].includes(t) || t.length > 0;
                        };
                        model.calendario.forEach(d => {
                            if (isWorking(d)) {
                                consecutive++; if (consecutive > maxConsecutive) maxConsecutive = consecutive;
                            } else consecutive = 0;
                        });
                        if (maxConsecutive > 6) {
                            alerts.push(\`<div class="emp-alert-box" style="background:#fff1f2; border-color:#fecdd3; color:#9f1239;"><i class="fas fa-running"></i><span><strong>EXCESO DE JORNADA:</strong> Detectados \${maxConsecutive} días seguidos trabajando sin descanso.</span></div>\`);
                        }
                    }
                    return alerts.join('');
                })()}

                <section class="emp-card">
                    <div class="drawer-section-title compact">INCIDENCIAS Y CAMBIOS</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div>
                            <h4 style="font-size:0.7rem; color:#64748b; margin-bottom:8px;">AUSENCIAS / VACACIONES</h4>
                            \${incidenciasActivas.length ? incidenciasActivas.map(ev => \`
                                <div style="background:#f8fafc; padding:10px; border-radius:8px; border-left:3px solid #ef4444; margin-bottom:8px;">
                                    <div style="font-weight:800; font-size:0.8rem;">\${escapeHtml(ev.tipo === 'VAC' ? 'VACACIONES 🏖️' : ev.tipo)}</div>
                                    <div style="font-size:0.7rem; color:#64748b;">\${ev.count > 1 ? \`<b>\${ev.count} días:</b> \${window.fmtDateLegacy(ev.fecha_inicio)} al \${window.fmtDateLegacy(ev.fecha_fin)}\` : \`\${window.fmtDateLegacy(ev.fecha_inicio)}\`}</div>
                                </div>
                            \`).join('') : '<div style="font-size:0.75rem; color:#94a3b8; font-style:italic;">Sin ausencias activas</div>'}
                        </div>
                        <div>
                            <h4 style="font-size:0.7rem; color:#64748b; margin-bottom:8px;">CAMBIOS / REFUERZOS</h4>
                            \${cambiosActivos.length ? cambiosActivos.map(ev => \`
                                <div style="background:#f8fafc; padding:10px; border-radius:8px; border-left:3px solid #3b82f6; margin-bottom:8px;">
                                    <div style="font-weight:800; font-size:0.8rem;">\${escapeHtml(ev.tipo)}</div>
                                    <div style="font-size:0.7rem; color:#64748b;">\${window.fmtDateLegacy(ev.fecha_inicio)}</div>
                                </div>
                            \`).join('') : '<div style="font-size:0.75rem; color:#94a3b8; font-style:italic;">Sin cambios pendientes</div>'}
                        </div>
                    </div>
                </section>

                <section class="emp-card">
                    <div class="drawer-section-title compact">CONTROL DE VACACIONES</div>
                    <div class="emp-annual-card vac" style="padding:12px; background:#fff; border:1px solid #e2e8f0; border-radius:12px;">
                        <div class="emp-annual-stats" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px;">
                            <div class="stat"><label>Derecho</label><strong>\${model.vacaciones.derechoAnual}</strong></div>
                            <div class="stat"><label>Usadas</label><strong class="val-vac">\${model.vacaciones.usadas}</strong></div>
                            <div class="stat"><label>Ajuste</label><strong>\${model.meta.regularizacion || 0}</strong></div>
                            <div class="stat highlight"><label>Saldo</label><strong class="\${model.vacaciones.saldo < 0 ? 'val-baja' : 'val-m'}">\${model.vacaciones.saldo}</strong></div>
                        </div>
                        <div style='font-size:0.6rem; color:#94a3b8; margin-top:8px; text-align:center;'>Saldo estimado basado en eventos VAC registrados en el año actual.</div>
                    </div>
                </section>

                <!-- SECCIÓN AVANZADA / LEGACY -->
                <div class="emp-legacy-section">
                    <div class="emp-legacy-header" onclick="document.getElementById('legacyContent').classList.toggle('open')">
                        <i class="fas fa-chevron-right"></i> SISTEMA LEGACY / IDENTIDAD TÉCNICA
                    </div>
                    <div id="legacyContent" class="emp-legacy-content">
                        <div style="font-size:0.7rem; color:#64748b;">ID Técnico Legacy: <strong>\${emp.id}</strong></div>
                        <div style="font-size:0.7rem; color:#64748b;">UUID: <strong>\${model.empleado_uuid || 'En proceso...'}</strong></div>
                    </div>
                </div>
            </div>
            
            <aside class="employee-side-panel">
                <section class="emp-card emp-calendar-card" style="position:sticky; top:0;">
                    <div class="emp-profile-toolbar" style="margin-bottom: 12px; background:#f1f5f9; padding:8px; border-radius:10px;">
                        <button class="emp-nav-btn" onclick="window.moveEmployeeProfilePeriod(-1)">&lsaquo;</button>
                        <h4 style="font-size: 0.8rem; flex:1; text-align:center; margin:0; text-transform:capitalize;">\${escapeHtml(titlePeriod)}</h4>
                        <button class="emp-nav-btn" onclick="window.moveEmployeeProfilePeriod(1)">&rsaquo;</button>
                    </div>
                    \${window.renderEmployeeProfileCalendar(model)}
                </section>
            </aside>
        </div>
    \`;

    const infoContent = \`
        <div class="employee-config-panel">
            <section class="emp-card">
                <h3>DATOS LABORALES PRINCIPALES</h3>
                <dl class="emp-grid">\${laboralRows.map(window.renderEmployeeProfileField).join('')}</dl>
            </section>
            <section class="emp-card">
                <h3>CONTACTO</h3>
                <dl class="emp-grid">\${contactoRows.map(window.renderEmployeeProfileField).join('')}</dl>
            </section>
            <section class="emp-card">
                <h3>NOTAS Y OBSERVACIONES</h3>
                <textarea data-emp-field="notas" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:12px; font-size:0.85rem;" rows="4">\${escapeHtml(emp.notas || '')}</textarea>
            </section>
        </div>
    \`;

    body.innerHTML = \`
        <article class="emp-profile">
            <header class="emp-profile-header">
                <div class="emp-profile-info">
                    <div class="emp-avatar-lg">\${window.employeeAvatar(emp.nombre, 64)}</div>
                    <div>
                        <h2>\${escapeHtml(emp.nombre)}</h2>
                        <div class="emp-badges">\${window.employeeProfileBadges(model).map(b => \`<span class="badge \${b.cls}">\${b.label}</span>\`).join('')}</div>
                    </div>
                </div>
                <div class="emp-profile-actions">
                    \${window._employeeProfileEditing
                        ? '<button type="button" class="btn-primary" onclick="window.saveEmployeeProfileInline()">Guardar Cambios</button><button type="button" class="btn-secondary" onclick="window.cancelEmployeeProfileEdit()">Cancelar</button>'
                        : '<button type="button" class="btn-primary" onclick="window.enableEmployeeProfileEdit()"><i class="fas fa-edit"></i> Editar Ficha</button>'}
                </div>
            </header>
            
            <div class="emp-profile-main-tabs">
                <button class="\${currentTab === 'overview' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('overview')">Vista General</button>
                <button class="\${currentTab === 'info' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('info')">Datos y Configuración</button>
            </div>

            <div id="empProfileTabContent" class="tab-fade-in">
                \${currentTab === 'overview' ? overviewContent : infoContent}
            </div>
        </article>
    \`;
};`;

const newPeriodLogic = `window.moveEmployeeProfilePeriod = (direction) => {
    const date = new Date(\`\${window._employeeProfileDate || window.isoDate(new Date())}T12:00:00\`);
    // Cambio de mes real, no solo días
    date.setMonth(date.getMonth() + direction);
    date.setDate(1); // Siempre al día 1 para evitar desbordamientos
    window._employeeProfileDate = window.isoDate(date);
    window.renderEmployeeProfile();
};`;

// REEMPLAZO MASIVO
const startMarker = 'window.buildEmployeeProfileModel =';
const nextMarkerAfterSave = 'window.openEmployeeDayDetail =';

const contentToReplaceStart = content.indexOf(startMarker);
const nextMarkerIdx = content.indexOf(nextMarkerAfterSave);

if (contentToReplaceStart !== -1 && nextMarkerIdx !== -1) {
    const newBlock = newBuildModel + '\n\n' + newRenderProfile + '\n\n' + newPeriodLogic;
    const newContent = content.substring(0, contentToReplaceStart) + newBlock + '\n\n' + content.substring(nextMarkerIdx);
    fs.writeFileSync(path, newContent, 'utf8');
    console.log('Successfully refactored admin.js for Profile isolation');
} else {
    console.log('Markers not found');
}
