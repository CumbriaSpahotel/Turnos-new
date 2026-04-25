// ==========================================
// 1. N�aCLEO Y CONFIGURACI�N GLOBAL
// ==========================================
window.parsedData = null;
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => document.querySelectorAll(s);

window.cleanLogText = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

window.DEBUG_MODE = false;

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
    const derechoAnual = esFijo ? 44 : Math.round((44 * (365 - ( (new Date(currentYear, 11, 31) - alta) / 86400000 ))) / 365);
    const generadas = esFijo ? 44 : Math.round((44 * diasEnAño) / 365);

    return {
        vacaciones: {
            derechoAnual: 44, // Visualmente mostramos 44
            generadas,
            usadas: vacacionesUsadas,
            saldo: (esFijo ? 44 : generadas) + regularizacion - vacacionesUsadas
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
            baseIndex
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

window.buildEmployeeProfileModel = (empleadoId, fechaReferencia) => {
    const DEFAULT_CONDICIONES = {
        vacaciones: { derechoAnual: 44, generadas: 0, usadas: 0, regularizacion: 0, saldo: 0 },
        descansos: { esperados: 0, reales: 0, diferencia: 0 },
        meta: { regularizacion: 0 }
    };

    const profile = (window.empleadosGlobales || []).find(e => window.normalizeId(e.id) === window.normalizeId(empleadoId) || window.normalizeId(e.nombre) === window.normalizeId(empleadoId));
    if (!profile) return null;

    const refISO = String(fechaReferencia || window.isoDate(new Date())).slice(0, 10);
    const mode = 'month';
    const eventos = window.eventosGlobales || window.eventosActivos || [];
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

    const excelSource = window._adminExcelEditableRows || window._adminExcelBaseOriginalRows || null;
    if (excelSource) {
        try {
            const hotelRows = excelSource[emp.hotel] || [];
            const baseRowsFlat = [];
            hotelRows.forEach(sRow => {
                if (!sRow?.empleadoId || !Array.isArray(sRow.values) || !sRow.weekStart) return;
                const fechasSemana = window.getFechasSemana ? window.getFechasSemana(sRow.weekStart) : [];
                sRow.values.forEach((turno, idx) => {
                    const fecha = fechasSemana[idx];
                    if (fecha) baseRowsFlat.push({ empleadoId: sRow.empleadoId, fecha, turno: turno || null });
                });
            });
            if (baseRowsFlat.length > 0 && window.buildIndices) {
                const built = window.buildIndices(window.empleadosGlobales || [], [], baseRowsFlat);
                baseIndex = built.baseIndex;
            }
        } catch (e) {
            if (window.DEBUG_MODE === true) {
                console.warn('[FICHA BASEINDEX ERROR]', { empleadoId, hotel: emp.hotel, error: e?.message });
            }
        }
    }
    // Fallback: usar _lastBaseIndex si no se pudo construir uno propio
    if (!baseIndex && window._lastBaseIndex) {
        baseIndex = window._lastBaseIndex;
    }

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
            mananas: null,
            tardes: null,
            noches: null,
            descansos: null,
            vacaciones: condiciones.vacaciones.usadas,
            bajas: null,
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
    if (key === 'id') return 'span-1';
    if (key === 'nombre') return 'span-5';
    if (key === 'hotel_id') return 'span-6';
    if (key === 'puesto') return 'span-4';
    if (['categoria', 'tipo_personal', 'contrato', 'estado_empresa'].includes(key)) return 'span-2';
    if (['fecha_alta', 'fecha_baja'].includes(key)) return 'span-4';
    if (['telefono', 'email'].includes(key)) return 'span-6';
    return 'span-2';
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
    
    // Custom logic for selects
    if (key === 'hotel_id') {
        const hotels = window._employeeLineHotels || [];
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

window.renderEmployeeProfilePanelBlock = (iconKey, title, rows) => `
    <section class="emp-card">
        <h3>${window.employeeIcon(iconKey)} ${escapeHtml(title)}</h3>
        <dl class="emp-grid">${rows.map(window.renderEmployeeProfileField).join('')}</dl>
    </section>
`;

window.renderEmployeeProfileCalendar = (model) => {
    const weekdays = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
    // Aseguramos que el calendario siempre muestre un bloque completo para evitar cortes
    const cells = model.calendario.map(day => {
        const cls = window.employeeShiftClass(day.turno, day.incidencia);
        const hasAlert = day.cambio || day.sustitucion;
        
        let label = window.employeeShiftLabel(day);
        if (day.incidencia === 'VAC') label = 'VAC';
        if (day.incidencia === 'BAJA') label = 'BAJA';
        
        return `
            <button class="emp-cal-cell emp-cal-${cls}${day.outsideMonth ? ' muted' : ''}" onclick="window.openEmployeeDayDetail('${day.fecha}')">
                <span class="emp-cal-date">${new Date(`${day.fecha}T12:00:00`).getDate()}</span>
                <strong>${label || '-'}</strong>
                <div class="emp-cal-indicators">
                    ${day.cambio ? '<i class="fas fa-exchange-alt" style="color:#3b82f6; font-size:0.5rem;"></i>' : ''}
                    ${day.sustitucion ? '<i class="fas fa-user-friends" style="color:#8b5cf6; font-size:0.5rem;"></i>' : ''}
                </div>
            </button>
        `;
    }).join('');
    
    return `
        <div class="emp-calendar-shell">
            <div class="emp-calendar-week-head">${weekdays.map(d => `<span>${d}</span>`).join('')}</div>
            <div class="emp-calendar-grid month">${cells}</div>
        </div>
        <div class="emp-cal-legend" style="margin-top:12px; display:flex; gap:12px; justify-content:center; font-size:0.65rem; color:#64748b;">
            <span><i class="fas fa-circle" style="color:#ccfbf1;"></i> Vac</span>
            <span><i class="fas fa-circle" style="color:#fee2e2;"></i> Baja</span>
            <span><i class="fas fa-exchange-alt" style="color:#3b82f6;"></i> Cambio</span>
        </div>
    `;
};

window.renderEmployeeProfile = () => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    if (!drawer || !body) return;
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    if (!model) return;
    drawer.classList.add('open');
    const emp = model.empleado;
    const status = window.employeeStatusMeta(emp.estado);
    const refISO = window._employeeProfileDate || window.isoDate(new Date());
    const refDate = new Date(`${refISO}T12:00:00`);
    const mode = 'month';
    const titlePeriod = refDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    const currentTab = window._employeeProfileTab || 'overview';

    const laboralRows = [
        ['ID Interno', emp.id_interno, 'id_interno'],
        ['Nombre', emp.nombre, 'nombre'], 
        ['Hotel Principal', emp.hotel, 'hotel_id'],
        ['Puesto', emp.puesto, 'puesto'], 
        ['Tipo', emp.tipo, 'tipo_personal'], 
        ['Estado', emp.estado, 'estado_empresa']
    ];

    const technicalRows = [
        ['ID técnico legacy', emp.id]
    ];

    if (emp.estado === 'Baja') {
        laboralRows.push(['Baja', emp.fechaBaja, 'fecha_baja', 'date']);
    }

    const assignedHotels = String(emp.hotelesAsignados || '').split(',').map(h => h.trim()).filter(Boolean);
    const hotelsRows = [
        ['Hoteles Operativos', emp.hotelesAsignados, 'hoteles_asignados', 'textarea']
    ];
    const contactoRows = [
        ['Tel', emp.telefono, 'telefono'], ['Email', emp.email, 'email'], ['Activo', emp.activo === false ? 'No' : 'Si', 'activo', 'boolean']
    ];
    const condiciones = model.condiciones || {};
    const vacaciones = model.vacaciones || {};
    const meta = model.meta || {};

    const vacationRows = [
        ['Derecho', vacaciones.derechoAnual], 
        ['Usadas', vacaciones.usadas], 
        ['Ajuste', meta.regularizacion || 0, 'ajuste_vacaciones_dias', 'number'], 
        ['Saldo', vacaciones.saldo]
    ];

    const eventList = model.eventosActivos.length
        ? model.eventosActivos.map(ev => `
            <div class="emp-event-item" onclick="window.openEmployeeIncidentDetail()">
                <strong>${escapeHtml(ev.tipo || 'Evento')}</strong>
                <span>${window.employeeEventDateRange(ev)}</span>
            </div>
        `).join('')
        : '<div class="emp-event-item"><span>Sin eventos</span></div>';

    // Cálculos para nuevos bloques
    const todayISO = window.isoDate(new Date());
    const turnoHoy = model.calendario.find(d => d.fecha === todayISO);
    const incidenciasActivas = model.eventosActivos.filter(ev => /VAC|BAJA|PERM/i.test(ev.tipo || ''));
    const cambiosActivos = model.eventosActivos.filter(ev => /CAMBIO|INTERCAMBIO|REFUERZO/i.test(ev.tipo || ''));
    
    const overviewContent = `
        <div class="employee-profile-layout">
            <div class="employee-config-panel">
                <!-- BLOQUE: ESTADO ACTUAL -->
                <div class="emp-operational-strip">
                    <div class="op-strip-card ${incidenciasActivas.length ? 'status-incident' : ''}">
                        <span class="label">Turno Hoy</span>
                        <span class="value">${turnoHoy ? (turnoHoy.turno || 'DESCANSO') : '--'}</span>
                    </div>
                    <div class="op-strip-card">
                        <span class="label">Hotel Actual</span>
                        <span class="value">${escapeHtml(emp.hotel)}</span>
                    </div>
                    <div class="op-strip-card">
                        <span class="label">Estado</span>
                        <span class="value">${incidenciasActivas.length ? 'INCIDENCIA' : 'OPERATIVO'}</span>
                    </div>
                </div>

                <!-- ALERTAS AUTOMÁTICAS (OPERATIVAS Y CONFLICTOS) -->
                ${(() => {
                    const showCounters = window.shouldShowEmployeeCounters && window.shouldShowEmployeeCounters(model.empleado, model.rowData);
                    const alerts = [];
                    
                    // Alerta Descanso - Solo para personal con control activo
                    if (showCounters && model.descansos.diferencia < -2) {
                        alerts.push(`<div class="emp-alert-box"><i class="fas fa-exclamation-triangle"></i><span><strong>ALERTA DE DESCANSO:</strong> Balance crítico de ${Math.abs(model.descansos.diferencia)} días. Riesgo de fatiga.</span></div>`);
                    }

                    // Alerta Días Seguidos - Solo para personal con control activo
                    if (showCounters) {
                        let consecutive = 0;
                        let maxConsecutive = 0;
                        model.calendario.forEach(d => {
                            if (d.turno && d.turno !== 'D' && !d.incidencia) {
                                consecutive++;
                                if (consecutive > maxConsecutive) maxConsecutive = consecutive;
                            } else {
                                consecutive = 0;
                            }
                        });
                        if (maxConsecutive > 6) {
                            alerts.push(`<div class="emp-alert-box" style="background:#fff1f2; border-color:#fecdd3; color:#9f1239;"><i class="fas fa-running"></i><span><strong>EXCESO DE JORNADA:</strong> Detectados ${maxConsecutive} días seguidos trabajando sin descanso.</span></div>`);
                        }
                    }

                    // Alerta Incoherencia (Turno + Incidencia)
                    const hasIncoherence = model.calendario.some(d => d.turno && d.turno !== 'D' && d.incidencia);
                    if (hasIncoherence) {
                        alerts.push(`<div class="emp-alert-box" style="background:#fef2f2; border-color:#fee2e2; color:#b91c1c;"><i class="fas fa-bug"></i><span><strong>INCOHERENCIA DE DATOS:</strong> El empleado tiene turnos asignados durante días de Vacaciones o Baja.</span></div>`);
                    }

                    return alerts.join('');
                })()}

                <section class="emp-card">
                    <div class="drawer-section-title compact">INCIDENCIAS Y CAMBIOS</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div>
                            <h4 style="font-size:0.7rem; color:#64748b; margin-bottom:8px;">AUSENCIAS</h4>
                            ${incidenciasActivas.length ? incidenciasActivas.map(ev => `
                                <div style="background:#f8fafc; padding:10px; border-radius:8px; border-left:3px solid #ef4444; margin-bottom:8px;">
                                    <div style="font-weight:800; font-size:0.8rem;">${escapeHtml(ev.tipo)}</div>
                                    <div style="font-size:0.7rem; color:#64748b;">${ev.fecha_inicio} al ${ev.fecha_fin || '...'}</div>
                                </div>
                            `).join('') : '<div style="font-size:0.75rem; color:#94a3b8; font-style:italic;">Sin ausencias activas</div>'}
                        </div>
                        <div>
                            <h4 style="font-size:0.7rem; color:#64748b; margin-bottom:8px;">CAMBIOS / REFUERZOS</h4>
                            ${cambiosActivos.length ? cambiosActivos.map(ev => `
                                <div style="background:#f8fafc; padding:10px; border-radius:8px; border-left:3px solid #3b82f6; margin-bottom:8px;">
                                    <div style="font-weight:800; font-size:0.8rem;">${escapeHtml(ev.tipo)}</div>
                                    <div style="font-size:0.7rem; color:#64748b;">${ev.fecha_inicio}</div>
                                </div>
                            `).join('') : '<div style="font-size:0.75rem; color:#94a3b8; font-style:italic;">Sin cambios pendientes</div>'}
                        </div>
                    </div>
                </section>

                ${(window.isEmpleadoOcasionalOApoyo && window.isEmpleadoOcasionalOApoyo(model.empleado)) ? '' : `
                <section class="emp-card">
                    <div class="drawer-section-title compact">CONTROL DE VACACIONES</div>
                    <div class="emp-annual-summary-grid" style="margin-top:0;">
                        <div class="emp-annual-card vac" style="padding:12px;">
                            <div class="emp-annual-stats" style="grid-template-columns: repeat(4, 1fr);">
                                <div class="stat"><label>Anual</label><strong>${model.vacaciones.derechoAnual}</strong></div>
                                <div class="stat"><label>Generadas</label><strong>${model.vacaciones.generadas}</strong></div>
                                <div class="stat"><label>Usadas</label><strong class="val-vac">${model.vacaciones.usadas}</strong></div>
                                <div class="stat highlight"><label>Saldo</label><strong class="${model.vacaciones.saldo < 0 ? 'val-baja' : 'val-m'}">${model.vacaciones.saldo}</strong></div>
                            </div>
                        </div>
                    </div>
                </section>
                `}
            </div>
            
            <aside class="employee-side-panel">
                <section class="emp-card emp-calendar-card">
                    <div class="emp-profile-toolbar" style="margin-bottom: 12px;">
                        <button class="emp-nav-btn" onclick="window.moveEmployeeProfilePeriod(-1)">&lsaquo;</button>
                        <h4 style="font-size: 0.8rem;">${escapeHtml(titlePeriod)}</h4>
                        <button class="emp-nav-btn" onclick="window.moveEmployeeProfilePeriod(1)">&rsaquo;</button>
                    </div>
                    ${window.renderEmployeeProfileCalendar(model)}
                </section>
            </aside>
        </div>
    `;

    const infoContent = `
        <div class="employee-config-panel" style="gap: 8px;">
            <div style="display:grid; grid-template-columns: 1fr 400px; gap: 12px;">
                <div style="display:flex; flex-direction:column; gap: 8px;">
                    ${window.renderEmployeeProfilePanelBlock('laboral', 'Datos laborales principales', laboralRows)}
                    <section class="emp-card">
                        <h3 style="border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 12px; font-size: 0.75rem; color: #64748b;">
                            Configuración Avanzada
                        </h3>
                        <div style="display:flex; flex-direction:column; gap: 8px;">
                            ${window.renderEmployeeProfilePanelBlock('technical', 'Sistema Legacy', technicalRows)}
                            <details class="emp-hotels-edit-details" style="border-top: 1px solid #f1f5f9; padding-top: 8px;">
                                <summary style="color: var(--accent); font-weight: 700; font-size: 0.7rem; cursor: pointer;">Notas de sistema...</summary>
                                <div style="margin-top: 8px;">
                                    ${window.renderEmployeeProfileField(['Notas internas', emp.notas, 'notas', 'textarea'])}
                                </div>
                            </details>
                        </div>
                    </section>
                </div>
                <div style="display:flex; flex-direction:column; gap: 8px;">
                    ${window.renderEmployeeProfilePanelBlock('contacto', 'Contacto', contactoRows)}
                    ${(window.shouldShowEmployeeCounters && window.shouldShowEmployeeCounters(model.empleado, model.rowData)) ? window.renderEmployeeProfilePanelBlock('vacaciones', 'Control de Vacaciones', vacationRows) : ''}
                </div>
            </div>
        </div>
    `;

    body.innerHTML = `
        <article class="employee-profile">
            <header class="employee-profile-head">
                <div class="emp-head-main-wrapper">
                    <div class="emp-profile-logo-shell">
                        <svg class="emp-logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        <div class="emp-logo-text">
                            <span>Sercotel</span>
                            <strong>Guadiana</strong>
                        </div>
                    </div>
                    ${window.employeeAvatar(emp.nombre)}
                    <div class="emp-head-main">
                        <h2>${escapeHtml(emp.nombre)} <span>#${escapeHtml(emp.id || 'N/A')}</span></h2>
                        <div class="emp-head-info">
                            <span>${window.employeeIcon('role')} ${escapeHtml(emp.puesto)}</span>
                            <span>&bull;</span>
                            <span>${window.employeeIcon('hotel')} ${escapeHtml(emp.hotel)}</span>
                        </div>
                    </div>
                </div>
                <div class="emp-profile-actions">
                    ${window._employeeProfileEditing
                        ? '<button type="button" class="primary" onclick="window.saveEmployeeProfileInline()">Guardar</button><button type="button" onclick="window.cancelEmployeeProfileEdit()">Cancelar</button>'
                        : '<button type="button" class="primary" onclick="window.enableEmployeeProfileEdit()">Editar Perfil</button>'}
                    <button type="button" onclick="window.openEmployeeActiveChanges()">
                        ${window.employeeIcon('cambios')} Cambios
                    </button>
                </div>
            </header>

            <div class="emp-head-facts">
                ${!(window.shouldShowEmployeeCounters && window.shouldShowEmployeeCounters(emp, model.rowData)) ? `
                    <div class="emp-fact-card">
                        <span>${window.employeeIcon('hotel')} Centro</span>
                        <strong>${escapeHtml(emp.hotel)}</strong>
                    </div>
                    <div class="emp-fact-card">
                        <span>${window.employeeIcon('role')} Categoría</span>
                        <strong>${escapeHtml(emp.puesto)}</strong>
                    </div>
                ` : `
                    <div class="emp-fact-card">
                        <span>${window.employeeIcon('vacaciones')} Saldo Vac</span>
                        <strong>${window.employeeFormatNumber(model.vacaciones.saldo)}</strong>
                    </div>
                    <div class="emp-fact-card">
                        <span>${window.employeeIcon('descansos')} Balance D</span>
                        <strong>${model.descansos.diferencia > 0 ? '+' : ''}${model.descansos.diferencia}</strong>
                    </div>
                `}
                <div class="emp-fact-card">
                    <span>${window.employeeIcon('cambios')} Cambios</span>
                    <strong>${window.employeeFormatNumber(model.resumen30d.cambios)}</strong>
                </div>
                <div class="emp-fact-card">
                    <span>${window.employeeIcon('eventos')} Eventos</span>
                    <strong>${model.eventosActivos.length}</strong>
                </div>
            </div>

            <div class="emp-profile-main-tabs">
                <button class="${currentTab === 'overview' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('overview')">
                    Vista General
                </button>
                <button class="${currentTab === 'info' ? 'active' : ''}" onclick="window.setEmployeeProfileTab('info')">
                    Información Laboral
                </button>
            </div>

            <div id="empProfileTabContent" class="tab-fade-in">
                ${currentTab === 'overview' ? overviewContent : infoContent}
            </div>
        </article>
    `;
};

window.setEmployeeProfileTab = (tab) => {
    window._employeeProfileTab = tab;
    window.renderEmployeeProfile();
};

window.openEmpDrawer = (idOrName) => {
    window._employeeProfileId = idOrName;
    window._employeeProfileDate = window.isoDate(new Date());
    window._employeeProfileMode = 'month';
    window._employeeProfileTab = 'overview';
    window._employeeProfileEditing = false;
    window.renderEmployeeProfile();
};

window.enableEmployeeProfileEdit = () => {
    window._employeeProfileEditing = true;
    window.renderEmployeeProfile();
};

window.cancelEmployeeProfileEdit = () => {
    window._employeeProfileEditing = false;
    window.renderEmployeeProfile();
};

window.saveEmployeeProfileInline = async () => {
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    if (!model) return;
    const line = (window._employeeLineModels || []).find(item => window.employeeNorm(item.id) === window.employeeNorm(model.empleado.id) || window.employeeNorm(item.nombre) === window.employeeNorm(model.empleado.nombre));
    const payload = { ...(line?.profile || {}), id: model.empleado.id };
    document.querySelectorAll('[data-emp-field]').forEach(input => {
        const key = input.dataset.empField;
        const type = input.dataset.empType || input.type;
        let value = input.value;
        if (type === 'boolean') value = value === 'true';
        if (type === 'number') value = value === '' ? null : Number(value);
        if (type === 'date' && value === '') value = null;
        payload[key] = value;
    });
    if (!payload.nombre) payload.nombre = model.empleado.nombre;
    try {
        await window.TurnosDB.upsertEmpleado(payload);

        // Auditoría específica para ID Interno (Fase 1)
        if (payload.id_interno && payload.id_interno !== (line?.profile?.id_interno)) {
            await window.TurnosDB.insertLog({
                usuario: 'ADMIN',
                resumen_json: {
                    accion: 'asignar_id_interno_empleado',
                    empleado_id_operativo: payload.id,
                    id_interno: payload.id_interno,
                    nombre: payload.nombre
                }
            }).catch(e => console.warn("Error al registrar log de ID Interno:", e));
        }

        window._employeeProfileEditing = false;
        await window.populateEmployees();
        window._employeeProfileId = payload.id || payload.nombre;
        window.renderEmployeeProfile();
    } catch (err) {
        console.error('[EMPLEADO ERROR]', {
            message: err?.message,
            context: 'saveEmployeeProfileInline',
            raw: err
        });
        alert(`No se pudo guardar la ficha: ${err.message}`);
    }
};

window.setEmployeeProfileMode = (mode) => {
    window._employeeProfileMode = mode === 'month' ? 'month' : 'week';
    window.renderEmployeeProfile();
};

window.moveEmployeeProfilePeriod = (direction) => {
    const mode = window._employeeProfileMode || 'week';
    const date = new Date(`${window._employeeProfileDate || window.isoDate(new Date())}T12:00:00`);
    date.setDate(date.getDate() + (mode === 'month' ? 31 * direction : 7 * direction));
    if (mode === 'month') date.setDate(1);
    window._employeeProfileDate = window.isoDate(date);
    window.renderEmployeeProfile();
};

window.openEmployeeDayDetail = (fecha) => {
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    const day = model?.calendario?.find(d => d.fecha === fecha);
    if (!day) return;
    alert([
        `Fecha: ${fecha}`,
        `Turno: ${window.employeeShiftLabel(day).replace(/&mdash;/g, '-')}`,
        day.turnoBase ? `Base: ${day.turnoBase}` : '',
        day.incidencia ? `Incidencia: ${day.incidencia}` : '',
        day.cambio ? 'Cambio de turno activo' : '',
        day.sustitucion ? 'Sustitucion activa' : ''
    ].filter(Boolean).join('\n'));
};

window.openEmployeeIncidentDetail = () => {
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    const events = model?.eventosActivos || [];
    alert(events.length
        ? events.map(ev => `${ev.tipo || 'Evento'}: ${window.employeeEventDateRange(ev).replace(/&mdash;/g, '-')}`).join('\n')
        : 'Sin incidencias activas para la fecha de referencia.');
};

window.openEmployeeActiveChanges = () => {
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    const changes = (model?.eventosActivos || []).filter(ev => /CAMBIO|INTERCAMBIO|REFUERZO/i.test(String(ev.tipo || '')));
    alert(changes.length
        ? changes.map(ev => `${ev.tipo || 'Cambio'}: ${window.employeeEventDateRange(ev).replace(/&mdash;/g, '-')}`).join('\n')
        : 'Sin cambios de turno activos.');
};

window.openEmployeeEditBasic = () => {
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    if (!model) return;
    const line = (window._employeeLineModels || []).find(item => window.employeeNorm(item.id) === window.employeeNorm(model.empleado.id));
    const profile = { ...(line?.profile || {}), id: model.empleado.id };
    const nombre = prompt('Nombre', model.empleado.nombre);
    if (nombre === null) return;
    const puesto = prompt('Puesto', model.empleado.puesto);
    if (puesto === null) return;
    const tipo = prompt('Tipo de empleado', model.empleado.tipo);
    if (tipo === null) return;
    window.TurnosDB.upsertEmpleado({ ...profile, nombre, puesto, tipo_personal: tipo })
        .then(() => window.populateEmployees())
        .catch(err => alert(`No se pudo guardar la ficha: ${err.message}`));
};

window.switchSection = (id) => {
    const sections = $$('.section');
    const menuItems = $$('.menu-item');
    
    sections.forEach(s => s.classList.remove('active'));
    menuItems.forEach(n => n.classList.remove('active'));

    const targetSec = $(`#section-${id}`);
    if (targetSec) targetSec.classList.add('active');
    
    const targetMenu = Array.from(menuItems).find(item => item.getAttribute('onclick')?.includes(`'${id}'`));
    if (targetMenu) targetMenu.classList.add('active');

    if (id === 'preview') window.renderPreview();
    if (id === 'excel') window.renderExcelView();
    if (id === 'home') window.renderDashboard();
    if (id === 'changes') window.renderCambiosTurno();
    if (id === 'vacations') window.location.href = 'vacaciones.html';
    if (id === 'bajas' || id === 'absences') window.location.href = 'bajas.html';
    if (id === 'requests') window.location.href = 'solicitudes.html';
};

window.renderCambiosTurno = async () => {
    const container = document.getElementById('changes-content');
    if (!container) return;

    try {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;">Historial de Cambios e Intercambios</h3>
                    <button class="btn-premium" onclick="window.location.href='cambios.html'" style="padding: 8px 16px; font-size: 0.75rem;">Abrir Gestor Avanzado</button>
                </div>
                <div id="changes-table-container">
                    <p style="opacity: 0.5;">Cargando registros de auditoría...</p>
                </div>
            </div>
        `;
        
        const events = await window.TurnosDB.fetchEventos();
        const changes = events.filter(e => /CAMBIO|INTERCAMBIO|REFUERZO/i.test(e.tipo || ''));
        
        const table = document.getElementById('changes-table-container');
        if (changes.length === 0) {
            table.innerHTML = '<div style="padding: 40px; text-align: center; opacity: 0.5;">No hay cambios registrados recientemente.</div>';
            return;
        }

        table.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="text-align: left; border-bottom: 2px solid var(--border);">
                        <th style="padding: 12px 8px;">Fecha</th>
                        <th style="padding: 12px 8px;">Tipo</th>
                        <th style="padding: 12px 8px;">Empleado</th>
                        <th style="padding: 12px 8px;">Detalle</th>
                    </tr>
                </thead>
                <tbody>
                    ${changes.slice(0, 50).map(c => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 8px;">${c.fecha_inicio}</td>
                            <td style="padding: 12px 8px;"><span class="badge" style="background: #e2e8f0;">${c.tipo}</span></td>
                            <td style="padding: 12px 8px;"><strong>${c.empleado_id}</strong></td>
                            <td style="padding: 12px 8px; font-size: 0.75rem;">${c.observaciones || c.turno_nuevo || '�'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('[ADMIN ERROR] Fallo al renderizar Cambios de Turno', {
            message: err.message,
            stack: err.stack,
            context: 'renderCambiosTurno'
        });
        container.innerHTML = '<div class="alert error">Error al cargar el módulo de cambios. Revisa la consola.</div>';
    }
};

window.renderVacationsModule = async () => {
    const container = document.getElementById('vacations-content');
    if (!container) return;

    // Estado local para filtros
    if (!window._vacationFilters) {
        window._vacationFilters = {
            hotel: 'all',
            search: '',
            estado: 'activo'
        };
    }

    container.innerHTML = `
        <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="margin: 0; font-size: 1.5rem; color: var(--text);">Gestión de Vacaciones</h2>
                    <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-dim);">Control centralizado de periodos de descanso</p>
                </div>
                <button class="btn-premium" onclick="window.openVacationModal()" style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-plus"></i> Nueva Vacación
                </button>
            </div>

            <div class="filters-bar" style="display: flex; gap: 16px; margin-bottom: 24px; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                <div style="flex: 1;">
                    <label style="display: block; font-size: 0.7rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; margin-bottom: 6px;">Buscar Empleado</label>
                    <input type="text" id="vac-search" class="input-premium" placeholder="Nombre..." value="${window._vacationFilters.search}" 
                        oninput="window._vacationFilters.search = this.value; window.renderVacationsTable();" style="width: 100%;">
                </div>
                <div style="width: 200px;">
                    <label style="display: block; font-size: 0.7rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; margin-bottom: 6px;">Hotel</label>
                    <select id="vac-hotel" class="input-premium" onchange="window._vacationFilters.hotel = this.value; window.renderVacationsTable();" style="width: 100%;">
                        <option value="all">Todos los Hoteles</option>
                        ${(window._employeeLineHotels || []).map(h => `<option value="${h}" ${window._vacationFilters.hotel === h ? 'selected' : ''}>${h}</option>`).join('')}
                    </select>
                </div>
                <div style="width: 150px;">
                    <label style="display: block; font-size: 0.7rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; margin-bottom: 6px;">Estado</label>
                    <select id="vac-estado" class="input-premium" onchange="window._vacationFilters.estado = this.value; window.renderVacationsTable();" style="width: 100%;">
                        <option value="activo" ${window._vacationFilters.estado === 'activo' ? 'selected' : ''}>Activos</option>
                        <option value="all" ${window._vacationFilters.estado === 'all' ? 'selected' : ''}>Todos</option>
                    </select>
                </div>
            </div>

            <div id="vacations-table-container">
                <div style="padding: 40px; text-align: center; opacity: 0.5;">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p style="margin-top: 12px;">Cargando vacaciones...</p>
                </div>
            </div>
        </div>
    `;

    window.renderVacationsTable();
};

window.renderVacationsTable = async () => {
    const tableContainer = document.getElementById('vacations-table-container');
    if (!tableContainer) return;

    try {
        const events = await window.TurnosDB.fetchEventos();
        let vacations = events.filter(ev => window.normalizeTipo(ev.tipo) === 'VAC');

        // Aplicar filtros
        const filters = window._vacationFilters;
        if (filters.hotel !== 'all') {
            vacations = vacations.filter(v => v.hotel === filters.hotel || v.hotel_origen === filters.hotel);
        }
        if (filters.search) {
            const s = window.employeeNorm(filters.search);
            vacations = vacations.filter(v => window.employeeNorm(v.empleado_id).includes(s) || window.employeeNorm(v.nombre).includes(s));
        }
        // fetchEventos ya filtra anulados por defecto, pero si filters.estado es 'all' y queremos verlos, tendríamos que haberlos traído.
        // Como fetchEventos usa .neq('estado', 'anulado'), para ver todos necesitamos un método que no filtre.
        // Por ahora, el filtro 'all' solo mostrará lo que trajo fetchEventos (activos/pendientes).

        if (vacations.length === 0) {
            tableContainer.innerHTML = `
                <div style="padding: 60px; text-align: center; background: rgba(0,0,0,0.02); border: 2px dashed var(--border); border-radius: 12px;">
                    <i class="fas fa-umbrella-beach fa-3x" style="opacity: 0.2; margin-bottom: 16px;"></i>
                    <p style="margin: 0; font-weight: 600; color: var(--text-dim);">No hay vacaciones registradas con estos filtros.</p>
                </div>
            `;
            return;
        }

        // Ordenar por fecha inicio desc
        vacations.sort((a, b) => String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)));

        tableContainer.innerHTML = `
            <table class="table-premium" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="text-align: left; border-bottom: 2px solid var(--border);">
                        <th style="padding: 16px 12px;">Empleado</th>
                        <th style="padding: 16px 12px;">Periodo</th>
                        <th style="padding: 16px 12px;">Hotel</th>
                        <th style="padding: 16px 12px;">Sustituto</th>
                        <th style="padding: 16px 12px;">Estado</th>
                        <th style="padding: 16px 12px; text-align: right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${vacations.map(v => {
                        const isCristina = window.employeeNorm(v.empleado_id).includes('cristina');
                        return `
                        <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.01)'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 16px 12px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    ${window.employeeAvatar(v.nombre || v.empleado_id)}
                                    <strong>${v.nombre || v.empleado_id}</strong>
                                </div>
                            </td>
                            <td style="padding: 16px 12px;">
                                <div style="display: flex; flex-direction: column;">
                                    <span>${window.employeeEventDateRange(v)}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-dim);">${v.observaciones || ''}</span>
                                </div>
                            </td>
                            <td style="padding: 16px 12px; color: var(--text-dim);">${v.hotel || v.hotel_origen || '�'}</td>
                            <td style="padding: 16px 12px;">
                                ${v.sustituto || v.sustituto_id ? `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;">${v.sustituto || v.sustituto_id}</span>` : '<span style="opacity:0.3">�</span>'}
                            </td>
                            <td style="padding: 16px 12px;">
                                <span class="badge" style="background: ${v.estado === 'activo' ? '#dcfce7; color:#166534;' : '#f1f5f9; color:#475569;'}">
                                    ${v.estado || 'activo'}
                                </span>
                            </td>
                            <td style="padding: 16px 12px; text-align: right;">
                                <button class="btn-icon" title="Anular" onclick="window.anularVacacion('${v.id}')" style="color: #ef4444; background: #fee2e2; border-radius: 8px; padding: 6px; border: none; cursor: pointer; margin-left: 4px;">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        tableContainer.innerHTML = `<div class="alert error">Error al cargar listado: ${err.message}</div>`;
    }
};

window.openVacationModal = (vacation = null) => {
    let modal = document.getElementById('vacationModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'vacationModal';
    modal.className = 'drawer-overlay open';
    modal.style.zIndex = '10000';
    
    const emps = (window.empleadosGlobales || []).sort((a,b) => a.nombre.localeCompare(b.nombre));
    const hotels = window._employeeLineHotels || [];

    modal.innerHTML = `
        <div class="glass-panel" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 450px; max-width: 95%; padding: 32px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
            <h3 style="margin: 0 0 24px; font-size: 1.25rem;">${vacation ? 'Editar Vacación' : 'Nueva Vacación'}</h3>
            
            <form id="vac-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label class="label-premium">Empleado</label>
                    <select id="form-vac-emp" class="input-premium" required style="width: 100%;">
                        <option value="">Seleccionar empleado...</option>
                        ${emps.map(e => `<option value="${e.id}" data-hotel="${e.hotel_id}">${e.nombre}</option>`).join('')}
                    </select>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <label class="label-premium">Desde</label>
                        <input type="date" id="form-vac-inicio" class="input-premium" required style="width: 100%;">
                    </div>
                    <div>
                        <label class="label-premium">Hasta</label>
                        <input type="date" id="form-vac-fin" class="input-premium" required style="width: 100%;">
                    </div>
                </div>

                <div>
                    <label class="label-premium">Sustituto (Opcional)</label>
                    <select id="form-vac-sust" class="input-premium" style="width: 100%;">
                        <option value="">Ninguno</option>
                        ${emps.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('')}
                    </select>
                </div>

                <div>
                    <label class="label-premium">Observaciones</label>
                    <textarea id="form-vac-obs" class="input-premium" style="width: 100%; height: 80px;"></textarea>
                </div>

                <div style="display: flex; gap: 12px; margin-top: 12px;">
                    <button type="button" class="btn-premium" onclick="document.getElementById('vacationModal').remove()" style="flex: 1; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">Cancelar</button>
                    <button type="submit" class="btn-premium" style="flex: 2;">Guardar Vacación</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const form = document.getElementById('vac-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const empId = document.getElementById('form-vac-emp').value;
        const empOption = document.getElementById('form-vac-emp').selectedOptions[0];
        const hotelId = empOption.dataset.hotel;
        const nombre = empOption.text;
        
        const payload = {
            tipo: 'VAC',
            empleado_id: empId,
            nombre: nombre,
            hotel: hotelId,
            hotel_origen: hotelId,
            fecha_inicio: document.getElementById('form-vac-inicio').value,
            fecha_fin: document.getElementById('form-vac-fin').value,
            sustituto_id: document.getElementById('form-vac-sust').value,
            sustituto: document.getElementById('form-vac-sust').selectedOptions[0].text === 'Ninguno' ? null : document.getElementById('form-vac-sust').selectedOptions[0].text,
            observaciones: document.getElementById('form-vac-obs').value,
            estado: 'activo'
        };

        try {
            window.addLog(`Guardando vacación para ${nombre}...`, 'info');
            await window.TurnosDB.upsertEvento(payload);
            window.addLog(`Vacación guardada con éxito.`, 'ok');
            
            // Recargar datos globales
            window.eventosActivos = await window.TurnosDB.fetchEventos();
            
            modal.remove();
            window.renderVacationsTable();
            
            // Si hay otros módulos abiertos que dependen de esto, se refrescarán al navegar o al forzar
            if (window._employeeProfileId) window.openEmpDrawer(window._employeeProfileId);
        } catch (err) {
            alert(`Error al guardar: ${err.message}`);
        }
    };
};

window.anularVacacion = async (id) => {
    if (!confirm('¿Seguro que deseas anular este periodo de vacaciones?')) return;

    try {
        window.addLog(`Anulando vacación ${id}...`, 'info');
        // El DAO no tiene un update parcial explícito para estado, pero upsertEvento puede usarse si tenemos el objeto completo.
        // Pero fetchEventos ya trajo el objeto.
        const events = await window.TurnosDB.fetchEventos();
        const vac = events.find(e => String(e.id) === String(id));
        if (!vac) throw new Error("No se encontró el registro.");

        await window.TurnosDB.upsertEvento({ ...vac, estado: 'anulado' });
        window.addLog(`Vacación anulada.`, 'ok');
        
        window.eventosActivos = await window.TurnosDB.fetchEventos();
        window.renderVacationsTable();
        if (window._employeeProfileId) window.openEmpDrawer(window._employeeProfileId);
    } catch (err) {
        alert(`Error al anular: ${err.message}`);
    }
};

window.renderAbsencesModule = async () => {
    const container = document.getElementById('absences-content');
    if (!container) return;

    container.innerHTML = `
        <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="margin: 0; font-size: 1.5rem; color: var(--text);">Gestión de Ausencias y Bajas</h2>
                    <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-dim);">Registro de IT, permisos y ausencias justificadas</p>
                </div>
                <button class="btn-premium" onclick="window.openAbsenceModal()" style="display: flex; align-items: center; gap: 8px; background: #f43f5e;">
                    <i class="fas fa-plus"></i> Nueva Baja/Permiso
                </button>
            </div>

            <div id="absences-table-container">
                <div style="padding: 40px; text-align: center; opacity: 0.5;">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p style="margin-top: 12px;">Cargando ausencias...</p>
                </div>
            </div>
        </div>
    `;

    window.renderAbsencesTable();
};

window.renderAbsencesTable = async () => {
    const tableContainer = document.getElementById('absences-table-container');
    if (!tableContainer) return;

    try {
        const events = await window.TurnosDB.fetchEventos();
        const absences = events.filter(ev => ['BAJA', 'PERMISO', 'PERM'].includes(window.normalizeTipo(ev.tipo)));

        if (absences.length === 0) {
            tableContainer.innerHTML = `<div style="padding: 40px; text-align: center; opacity: 0.5;">No hay ausencias activas registradas.</div>`;
            return;
        }

        absences.sort((a, b) => String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)));

        tableContainer.innerHTML = `
            <table class="table-premium" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="text-align: left; border-bottom: 2px solid var(--border);">
                        <th style="padding: 16px 12px;">Empleado</th>
                        <th style="padding: 16px 12px;">Tipo</th>
                        <th style="padding: 16px 12px;">Periodo</th>
                        <th style="padding: 16px 12px; text-align: right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${absences.map(a => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 16px 12px;"><strong>${a.nombre || a.empleado_id}</strong></td>
                            <td style="padding: 16px 12px;"><span class="badge" style="background:#fee2e2; color:#b91c1c;">${a.tipo}</span></td>
                            <td style="padding: 16px 12px;">${window.employeeEventDateRange(a)}</td>
                            <td style="padding: 16px 12px; text-align: right;">
                                <button class="btn-icon" onclick="window.anularVacacion('${a.id}')" style="color: #ef4444;"><i class="fas fa-trash-alt"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        tableContainer.innerHTML = `<div class="alert error">Error: ${err.message}</div>`;
    }
};

window.openAbsenceModal = () => {
    // Reutilizamos el modal de vacaciones con ajustes mínimos de tipo
    window.openVacationModal();
    const title = document.querySelector('#vacationModal h3');
    if (title) title.textContent = 'Nueva Baja / Permiso';
    const form = document.getElementById('vac-form');
    // Inyectar selector de tipo
    const typeDiv = document.createElement('div');
    typeDiv.innerHTML = `
        <label class="label-premium">Tipo de Ausencia</label>
        <select id="form-abs-type" class="input-premium" style="width: 100%;">
            <option value="BAJA">Baja Médica (IT)</option>
            <option value="PERMISO">Permiso Retribuido</option>
            <option value="OTRO">Otro</option>
        </select>
    `;
    form.insertBefore(typeDiv, form.firstChild);
    
    // Sobrescribir el submit
    form.onsubmit = async (e) => {
        e.preventDefault();
        const empOption = document.getElementById('form-vac-emp').selectedOptions[0];
        const payload = {
            tipo: document.getElementById('form-abs-type').value,
            empleado_id: document.getElementById('form-vac-emp').value,
            nombre: empOption.text,
            hotel: empOption.dataset.hotel,
            fecha_inicio: document.getElementById('form-vac-inicio').value,
            fecha_fin: document.getElementById('form-vac-fin').value,
            observaciones: document.getElementById('form-vac-obs').value,
            estado: 'activo'
        };
        await window.TurnosDB.upsertEvento(payload);
        window.eventosActivos = await window.TurnosDB.fetchEventos();
        document.getElementById('vacationModal').remove();
        window.renderAbsencesTable();
    };
};

window.ADMIN_EXCEL_STORAGE_KEY = 'turnosweb_admin_excel_base_v1';

window.cloneExcelRows = (value) => JSON.parse(JSON.stringify(value || {}));

window.loadAdminExcelSourceRows = async ({ forceBase = false } = {}) => {
    if (!window._adminExcelBaseOriginalRows || forceBase) {
        window._adminExcelBaseOriginalRows = window.cloneExcelRows(await window.ExcelLoader.loadExcelSourceRows());
    }

    if (forceBase) {
        return window.cloneExcelRows(window._adminExcelBaseOriginalRows);
    }

    if (window._adminExcelEditableRows) return window._adminExcelEditableRows;

    try {
        const stored = localStorage.getItem(window.ADMIN_EXCEL_STORAGE_KEY);
        if (stored) {
            window._adminExcelEditableRows = JSON.parse(stored);
            return window._adminExcelEditableRows;
        }
    } catch (error) {
        console.warn('No se pudieron leer los cambios locales del Excel base:', error);
    }

    window._adminExcelEditableRows = window.cloneExcelRows(window._adminExcelBaseOriginalRows);
    return window._adminExcelEditableRows;
};

window.persistAdminExcelSourceRows = () => {
    const rows = window._adminExcelEditableRows || {};
    localStorage.setItem(window.ADMIN_EXCEL_STORAGE_KEY, JSON.stringify(rows));
    window.addLog('Base Excel guardada en local', 'ok');
};

window.resetAdminExcelSourceRows = async () => {
    localStorage.removeItem(window.ADMIN_EXCEL_STORAGE_KEY);
    window._adminExcelEditableRows = await window.loadAdminExcelSourceRows({ forceBase: true });
    window.renderExcelView();
    window.renderPreview();
    if (window.populateEmployees) window.populateEmployees();
};

window.findEditableExcelRow = (hotel, weekStart, rowIndex) => {
    const rows = window._adminExcelEditableRows?.[hotel] || [];
    return rows.find(row => String(row.weekStart) === String(weekStart) && Number(row.rowIndex) === Number(rowIndex)) || null;
};

window.updateExcelBaseName = (hotel, weekStart, rowIndex, value) => {
    const row = window.findEditableExcelRow(hotel, weekStart, rowIndex);
    if (!row) return;
    row.displayName = String(value || '').trim();
    row.empleadoId = row.displayName;
};

window.updateExcelBaseShift = (hotel, weekStart, rowIndex, offset, value) => {
    const row = window.findEditableExcelRow(hotel, weekStart, rowIndex);
    if (!row) return;
    row.values[offset] = window.normalizePreviewTurno(value);
};

window.renderExcelView = async () => {
    const container = $('#excel-grid-container');
    if (!container) return;

    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-dim);">Cargando Excel base...</div>';

    try {
        const baseOriginal = await window.loadAdminExcelSourceRows({ forceBase: true });
        const baseEditado = await window.loadAdminExcelSourceRows();
        const excelRows = baseEditado;
        const hotelSelect = $('#excelHotel');
        const monthInput = $('#excelMonth');
        const selectedHotel = hotelSelect?.value || 'all';

        if (monthInput && !monthInput.value) monthInput.value = window.isoDate(new Date()).slice(0, 7);
        const selectedMonth = monthInput?.value || window.isoDate(new Date()).slice(0, 7);
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthStart = `${selectedMonth}-01`;
        const monthEnd = window.isoDate(new Date(year, month, 0));

        const hotels = Object.keys(excelRows || {});
        if (hotelSelect && hotelSelect.options.length <= 1) {
            hotelSelect.innerHTML = `<option value="all">Filtro por Hotel: Ver Todos</option>${hotels.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('')}`;
            hotelSelect.value = selectedHotel;
        }

        const hotelsToRender = selectedHotel === 'all' ? hotels : [selectedHotel];
        const shiftOptions = ['', 'M', 'T', 'N', 'D'];

        container.innerHTML = `
            <div style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; gap:12px; border-bottom:1px solid var(--border); background:var(--bg3);">
                <div>
                    <div style="font-weight:800; color:var(--text);">Modo Excel</div>
                    <div style="font-size:0.75rem; color:var(--text-dim);">Base original separada de base editada (${Object.keys(baseOriginal || {}).length} hoteles). Los cambios se guardan en local y no tocan backend.</div>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn active" onclick="window.persistAdminExcelSourceRows(); window.renderPreview(); if (window.populateEmployees) window.populateEmployees();" style="background:var(--accent); color:white;">Guardar base</button>
                    <button class="btn" onclick="window.resetAdminExcelSourceRows()" style="background:var(--bg3); color:var(--text); border:1px solid var(--border);">Restaurar base original</button>
                </div>
            </div>
        `;

        const sections = hotelsToRender.map(hotel => {
            const rows = (excelRows[hotel] || [])
                .filter(row => {
                    const rowEnd = window.addIsoDays(row.weekStart, 6);
                    return row.weekStart <= monthEnd && rowEnd >= monthStart;
                })
                .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.rowIndex - b.rowIndex);

            if (!rows.length) {
                return `
                    <div style="padding:24px; border-bottom:1px solid #eef2f7;">
                        <div style="font-weight:800; color:#0f172a; margin-bottom:8px;">${escapeHtml(hotel)}</div>
                        <div style="color:#64748b; font-size:0.85rem;">No hay filas del Excel base para este mes.</div>
                    </div>
                `;
            }

            return `
                <div style="padding:0 0 24px 0; border-bottom:1px solid #eef2f7;">
                    <div style="padding:18px 20px; font-weight:800; color:#0f172a; background:#f8fafc; border-bottom:1px solid #eef2f7;">${escapeHtml(hotel)}</div>
                    <div style="overflow:auto;">
                        <table style="width:100%; border-collapse:collapse; min-width:980px; background:white;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:10px 12px; border-bottom:1px solid #eef2f7; text-align:left;">Semana</th>
                                    <th style="padding:10px 12px; border-bottom:1px solid #eef2f7; text-align:left;">Empleado</th>
                                    ${['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map(day => `<th style="padding:10px 8px; border-bottom:1px solid #eef2f7; text-align:center;">${day}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(row => `
                                    <tr>
                                        <td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">${escapeHtml(window.fmtDateLegacy(row.weekStart))}</td>
                                        <td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; min-width:220px;">
                                            <input type="text" value="${escapeHtml(row.displayName || row.empleadoId || '')}" onchange="window.updateExcelBaseName(${JSON.stringify(hotel)}, ${JSON.stringify(row.weekStart)}, ${row.rowIndex}, this.value)" style="width:100%; padding:8px 10px; border:1px solid #dbe4ee; border-radius:10px; background:white;">
                                        </td>
                                        ${[0, 1, 2, 3, 4, 5, 6].map(offset => `
                                            <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">
                                                <select onchange="window.updateExcelBaseShift(${JSON.stringify(hotel)}, ${JSON.stringify(row.weekStart)}, ${row.rowIndex}, ${offset}, this.value)" style="width:72px; padding:8px; border:1px solid #dbe4ee; border-radius:10px; background:white; text-align:center;">
                                                    ${shiftOptions.map(option => `<option value="${option}" ${String(row.values?.[offset] || '') === option ? 'selected' : ''}>${option || '-'}</option>`).join('')}
                                                </select>
                                            </td>
                                        `).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML += sections || '<div style="padding: 2rem; text-align: center; color: var(--text-dim);">No hay datos del Excel base para el filtro actual.</div>';
    } catch (error) {
        container.innerHTML = `<div style="padding:2rem; color:red;">Error cargando Excel base: ${escapeHtml(error.message)}</div>`;
    }
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
    const btnW = $('#btnViewWeekly'), btnM = $('#btnViewMonthly');
    const dateC = $('#prevDateContainer'), monthC = $('#prevMonthContainer');
    if (btnW) btnW.classList.toggle('active', mode === 'weekly');
    if (btnM) btnM.classList.toggle('active', mode === 'monthly');
    if (dateC) dateC.style.display = mode === 'weekly' ? 'flex' : 'none';
    if (monthC) monthC.style.display = mode === 'monthly' ? 'flex' : 'none';
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

    // B) Construir mapa de sustituciones por ausencia (VAC, BAJA, PERMISO, FORMACION)
    eventos.forEach(ev => {
        const tipo = window.normalizeTipo(ev.tipo);
        if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION'].includes(tipo)) return;
        if (window.normalizeEstado(ev.estado) === 'anulado') return;
        if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

        const sustitutoRaw = ev.empleado_destino_id || ev.sustituto_id ||
            ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto;
        if (!sustitutoRaw) return;

        const titularRaw = ev.empleado_id;
        if (!titularRaw) return;

        const normSust = window.normalizeId(sustitutoRaw);
        const fi = window.normalizeDate(ev.fecha_inicio);
        const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);

        const normTitularChk = window.normalizeId(titularRaw);
        const titularRowMatch = sourceRows.find(r => window.normalizeId(r.empleadoId) === normTitularChk);
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
    window._lastBaseIndex = baseIndex;
    window._lastEventos = eventos; // Para debugging

    const puestos = Array.from(puestosMap.values()).sort((a, b) => a.rowIndex - b.rowIndex);

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
            baseIndex
        });

        return {
            turno: res.turno,
            titular: res.sustituidoPor ? (employees.find(e => window.normalizeId(e.id) === window.normalizeId(res.empleadoId) || window.normalizeId(e.nombre) === window.normalizeId(res.empleadoId))?.nombre || res.empleadoId) : (employees.find(e => window.normalizeId(e.id) === window.normalizeId(asig.titular_id) || window.normalizeId(e.nombre) === window.normalizeId(asig.titular_id))?.nombre || asig.titular_id),
            real: employees.find(e => window.normalizeId(e.id) === window.normalizeId(res.empleadoId) || window.normalizeId(e.nombre) === window.normalizeId(res.empleadoId))?.nombre || res.empleadoId,
            incidencia: res.incidencia,
            puesto_id: puestoId,
            hotel_id: hotel,
            fecha,
            turno_base: res.turnoBase,
            titular_id: asig.titular_id,
            real_id: res.empleadoId,
            cobertura: !!res.sustituidoPor,
            cambio: res.cambio,
            intercambio: res.intercambio,
            _finalState: res
        };
    };

    const getTurnoEmpleado = (empleadoId, fecha) => {
        const profile = employees.find(e => window.normalizeId(e.id) === window.normalizeId(empleadoId) || window.normalizeId(e.nombre) === window.normalizeId(empleadoId));
        const sRow = sourceRows.find(r => window.normalizeId(r.empleadoId) === window.normalizeId(empleadoId));
        const dateIdx = dates.indexOf(fecha);
        const turnoBase = (sRow && dateIdx !== -1) ? sRow.values[dateIdx] : null;

        return window.resolveEmployeeDay({
            empleado: profile,
            empleadoId,
            hotel,
            fecha,
            turnoBase,
            eventos,
            baseIndex
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
                        empleado: profile || { id: empleadoId, nombre: empleadoId },
                        empleadoId,
                        hotel,
                        fecha,
                        turnoBase,
                        eventos,
                        baseIndex
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
        const res = getTurnoEmpleado(empleadoId, fecha);
        return { ...res, _finalState: res };
    };

    const getEmployees = () => {
        const operativeRows = [];
        const deferredRows = [];
        const usedAsSust = new Set();
        const handledTitulars = new Set();

        const coverageLookup = new Map();
        ausenciaSustitucionMap.forEach((coberturas, normSust) => {
            coberturas.forEach(cob => {
                const isVisible = dates.some(d => d >= cob.fi && d <= cob.ff);
                if (isVisible) coverageLookup.set(cob.normTitular, { normSust, rawSust: cob.sustitutoRaw });
            });
        });

        sourceRows.forEach(r => {
            const normTitular = window.normalizeId(r.empleadoId);
            if (handledTitulars.has(normTitular)) return;
            const coverage = coverageLookup.get(normTitular);

            if (coverage) {
                const { normSust, rawSust } = coverage;
                if (!usedAsSust.has(normSust)) {
                    const empProfile = employees.find(e => window.normalizeId(e.id) === normSust || window.normalizeId(e.nombre) === normSust);
                    operativeRows.push({
                        hotel,
                        hotel_id: hotel,
                        puesto: `Puesto ${String((r.rowIndex || 0) + 1).padStart(2, '0')}`,
                        posicionId: r.rowIndex,
                        orden: r.rowIndex,
                        ordenOriginal: r.rowIndex,
                        employee_id: rawSust,
                        empleadoId: rawSust,
                        nombre: empProfile?.nombre || rawSust,
                        empleado: empProfile?.nombre || rawSust,
                        displayName: empProfile?.nombre || rawSust,
                        empleadoMostrado: empProfile?.nombre || rawSust,
                        empleadoReal: rawSust,
                        titularAusente: null,
                        sustitutoDe: r.empleadoId,
                        esCoberturaAusencia: true,
                        esAusenteInformativo: false,
                        _originalTitularId: r.empleadoId
                    });
                    usedAsSust.add(normSust);
                }
                deferredRows.push({
                    hotel,
                    hotel_id: hotel,
                    puesto: 'Ausente',
                    posicionId: r.rowIndex,
                    orden: r.rowIndex,
                    ordenOriginal: r.rowIndex,
                    employee_id: r.empleadoId,
                    empleadoId: r.empleadoId,
                    nombre: r.displayName || r.empleadoId,
                    empleado: r.displayName || r.empleadoId,
                    displayName: r.displayName || r.empleadoId,
                    empleadoMostrado: r.displayName || r.empleadoId,
                    empleadoReal: r.empleadoId,
                    titularAusente: r.empleadoId,
                    sustitutoDe: null,
                    esCoberturaAusencia: false,
                    esAusenteInformativo: true
                });
                handledTitulars.add(normTitular);
            } else {
                if (!usedAsSust.has(normTitular)) {
                    operativeRows.push({
                        hotel,
                        hotel_id: hotel,
                        puesto: `Puesto ${String((r.rowIndex || 0) + 1).padStart(2, '0')}`,
                        posicionId: r.rowIndex,
                        orden: r.rowIndex,
                        ordenOriginal: r.rowIndex,
                        employee_id: r.empleadoId,
                        empleadoId: r.empleadoId,
                        nombre: r.displayName || r.empleadoId,
                        empleado: r.displayName || r.empleadoId,
                        displayName: r.displayName || r.empleadoId,
                        empleadoMostrado: r.displayName || r.empleadoId,
                        empleadoReal: r.empleadoId,
                        titularAusente: null,
                        sustitutoDe: null,
                        esCoberturaAusencia: false,
                        esAusenteInformativo: false
                    });
                    handledTitulars.add(normTitular);
                }
            }
        });

        ausenciaSustitucionMap.forEach((coberturas, normSust) => {
            if (usedAsSust.has(normSust)) return;
            const hasActive = coberturas.some(cob => dates.some(d => d >= cob.fi && d <= cob.ff));
            if (hasActive) {
                const empProfile = employees.find(e => window.normalizeId(e.id) === normSust || window.normalizeId(e.nombre) === normSust);
                const rawSust = coberturas[0].sustitutoRaw;
                operativeRows.push({ 
                    hotel, 
                    hotel_id: hotel,
                    puesto: 'Personal Apoyo', 
                    employee_id: rawSust,
                    empleadoId: rawSust,
                    nombre: empProfile?.nombre || rawSust,
                    displayName: empProfile?.nombre || rawSust,
                    empleadoMostrado: empProfile?.nombre || rawSust, 
                    empleadoReal: rawSust, 
                    esCoberturaAusencia: true, 
                    esAusenteInformativo: false 
                });
                usedAsSust.add(normSust);
            }
        });

        operativeRows.sort((a, b) => (a.ordenOriginal ?? 999) - (b.ordenOriginal ?? 999));
        const finalRows = [...operativeRows, ...deferredRows];
        
        // Diagnóstico DEBUG
        if (window.DEBUG_MODE) {
            console.log('[GET_EMPLOYEES_SAMPLE]', finalRows.slice(0, 3).map(r => ({
                id: r.employee_id,
                name: r.nombre,
                display: r.displayName
            })));
        }
        
        return finalRows;
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
        getEmployeeName: (id) => employees.find(e => window.normalizeId(e.id) === window.normalizeId(id) || window.normalizeId(e.nombre) === window.normalizeId(id))?.nombre || id
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

            if (celda.incidencia && (!celda.real || celda.real === celda.titular)) {
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
    return window.TurnosRules?.definitions?.[key]?.label || turnoEmpleado.turno || '�';
};

window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => `
    <div style="display:flex; flex-direction:column; gap:4px;">
        <span style="font-weight:800; color:#0f172a; font-size:0.82rem;">${escapeHtml(employee?.displayName || employee?.employee_id || 'Empleado')}${showVacationIcon && employee?.isOnVacationVisibleRange ? ' �x�️' : ''}</span>
    </div>
`;

window.renderEmpleadoCell = (turnoEmpleado) => {
    const data = turnoEmpleado;
    const turnoBase = data?.turno_base ?? data?._celda?.turno_base ?? '';
    const turnoFinal = data?.turno ?? '';
    const hasSustitucion = Boolean(data?.real && data?.titular && data.real !== data.titular);
    const normalizeTurnoCode = (value) => window.normalizePreviewTurno
        ? window.normalizePreviewTurno(value || '')
        : String(value || '').trim().toUpperCase();
    const internalShiftCodes = new Set([
        'CT',
        'CAMBIO',
        'CAMBIO_TURNO',
        'INTERCAMBIO',
        'INTERCAMBIO_TURNO',
        'INTERCAMBIO_HOTEL',
        'CAMBIO_HOTEL',
        'CAMBIO_POSICION',
        'INTERCAMBIO_POSICION'
    ]);
    const isStateChange = (state) => {
        const reason = String(state?.sourceReason || '').toUpperCase();
        return Boolean(
            state
            && !state.isAbsence
            && (
                state.isModified
                || reason.includes('CAMBIO')
                || reason.includes('INTERCAMBIO')
                || reason.includes('OVERRIDE')
                || reason.includes('REFUERZO')
            )
        );
    };
    const stateToVisibleTurno = (state) => {
        if (!state || state.isAbsence) return '';
        const turno = normalizeTurnoCode(state.turnoFinal);
        if (turno && !internalShiftCodes.has(turno)) return turno;
        if (String(state.estadoFinal || '').toUpperCase() === 'DESCANSO') return 'D';
        return '';
    };

    const normalizarTurnoVisible = (cellData) => {
        if (!cellData) return '';

        if (cellData.incidencia === 'VAC') return 'VAC';
        if (cellData.incidencia === 'BAJA') return 'BAJA';
        if (cellData.incidencia === 'PERM' || cellData.incidencia === 'PERMISO') return 'PERM';

        const candidateStates = [
            cellData._celda?._realState,
            cellData._celda?._finalState,
            cellData._celda?._titularState
        ];

        for (const state of candidateStates) {
            if (!isStateChange(state)) continue;
            const resolvedTurno = stateToVisibleTurno(state);
            if (resolvedTurno) return resolvedTurno;
        }

        const rawTurno = normalizeTurnoCode(cellData.turno);
        if (rawTurno && !internalShiftCodes.has(rawTurno)) return rawTurno;

        const fallbackTurnos = [
            stateToVisibleTurno(cellData._celda?._realState),
            stateToVisibleTurno(cellData._celda?._finalState),
            stateToVisibleTurno(cellData._celda?._titularState),
            cellData.turno_base,
            cellData._celda?.turno_base
        ];

        for (const candidate of fallbackTurnos) {
            const normalized = normalizeTurnoCode(candidate);
            if (normalized && !internalShiftCodes.has(normalized)) return normalized;
        }

        return '';
    };

    const turnoVisible = normalizarTurnoVisible(data);
    const turnoBaseVisible = normalizeTurnoCode(turnoBase);
    const hayCambio = Boolean(
        data?.cambio === true
        || data?.intercambio === true
        || data?.origen === 'evento_ct'
        || (
            turnoVisible
            && turnoBaseVisible
            && !['VAC', 'BAJA', 'PERM', 'PERMISO'].includes(turnoVisible)
            && turnoVisible !== turnoBaseVisible
        )
    );

    const getTurnoLabel = (turno) => {
        const normalized = normalizeTurnoCode(turno);
        const key = window.TurnosRules?.shiftKey(normalized, 'NORMAL') || '';
        return window.TurnosRules?.definitions?.[key]?.label || normalized || ' ';
    };

    const getIncidenciaLabel = (incidencia) => {
        if (incidencia === 'VAC') return 'Vacaciones';
        if (incidencia === 'BAJA') return 'Baja';
        if (incidencia === 'PERM') return 'Permiso';
        return incidencia || '';
    };

    const getTurnoDisplayLine = (turno) => {
        const turnoLabel = getTurnoLabel(turno);
        return `${escapeHtml(turnoLabel)}${data?.intercambio ? ' 🔄 ' : ''}`;
    };

    const getVisualStyle = () => {
        if (!data) {
            return 'background:#f8fafc; color:#475569; border:1px dashed #cbd5e1;';
        }
        if (data.conflicto) {
            return 'background:#fff7ed; color:#9a3412; border:1px solid #fdba74;';
        }
        if (data.incidencia === 'VAC') {
            return 'background:#e0f2fe; color:#075985; border:1px solid #7dd3fc;';
        }
        if (data.incidencia === 'BAJA') {
            return 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;';
        }
        if (data.incidencia === 'PERM' || data.incidencia === 'PERMISO') {
            return 'background:#ffedd5; color:#9a3412; border:1px solid #fdba74;';
        }

        const shiftKey = window.TurnosRules?.shiftKey(turnoVisible || turnoBaseVisible || '', 'NORMAL') || '';
        if (shiftKey === 'm') {
            return 'background:#dcfce7; color:#166534; border:1px solid #86efac;';
        }
        if (shiftKey === 't') {
            return 'background:#fef3c7; color:#92400e; border:1px solid #fcd34d;';
        }
        if (shiftKey === 'n') {
            return 'background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd;';
        }
        if (shiftKey === 'd') {
            return 'background:#e5e7eb; color:#991b1b; border:1px solid #d1d5db;';
        }

        return 'background:#f8fafc; color:#1e293b; border:1px solid #e2e8f0;';
    };

    const buildContainer = (title, lines, extraLine = '') => `
        <div title="${escapeHtml(title)}" style="display:flex; flex-direction:column; gap:6px; min-height:86px; padding:10px 8px; border-radius:12px; background:#ffffff;">
            <div style="display:flex; flex-direction:column; gap:4px; align-items:stretch;">
                ${lines.map(line => `
                    <div style="display:inline-flex; align-items:center; justify-content:center; text-align:center; padding:8px 6px; border-radius:10px; font-size:0.76rem; font-weight:800; ${getVisualStyle()}">
                        ${line}
                    </div>
                `).join('')}
            </div>
            ${extraLine}
        </div>
    `;

    if (!data) {
        return buildContainer('Sin turno', ['&mdash;']);
    }

    if (data.conflicto) {
        return buildContainer(
            'Conflicto: múltiples asignaciones',
            ['&#9888; Conflicto'],
            `<div style="font-size:0.7rem; color:#9a3412; text-align:center;">(múltiples asignaciones)</div>`
        );
    }

    if (['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION'].includes(data.incidencia)) {
        const finalCellHtml = window.renderTurnoContent ? window.renderTurnoContent(data.incidencia) : escapeHtml(data.incidencia);
        return buildContainer(data.incidencia, [finalCellHtml]);
    }

    if (!turnoVisible) {
        return buildContainer('Sin turno', ['&mdash;']);
    }

    if (hasSustitucion) {
        const turnoLabel = getTurnoLabel(turnoVisible);
        const turnoDisplayLine = getTurnoDisplayLine(turnoVisible);
        const details = `(Sustituye a ${escapeHtml(data.titular || ' ')})`;
        return buildContainer(turnoLabel, [turnoDisplayLine], `
            <div style="font-size:0.7rem; color:#475569; text-align:center;">${details}</div>
        `);
    }

    const turnoLabelRaw = getTurnoLabel(turnoVisible);
    const finalCellHtml = window.renderTurnoContent ? window.renderTurnoContent(turnoVisible, { intercambio: !!data.intercambio }) : escapeHtml(turnoLabelRaw);
    return buildContainer(turnoLabelRaw, [finalCellHtml]);
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
        } else {
            const [y, m] = rawMonth.split('-').map(Number);
            start = new Date(y, m - 1, 1);
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
            const employeesToRender = previewModel.getEmpleadosVisibles
                ? previewModel.getEmpleadosVisibles(startISO, endISO)
                : previewModel.getEmployees();
            const orderedEmployeesToRender = previewModel.ordenarEmpleados
                ? previewModel.ordenarEmpleados(employeesToRender, columns.map(c => c.date))
                : employeesToRender;
            
            // DEDUPLICACIÓN DE SEGURIDAD (Si Admin no lo muestra duplicado, nosotros tampoco)
            const seenEmps = new Set();
            const deduplicatedList = [];
            orderedEmployeesToRender.forEach(emp => {
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
                        // Asegurar que describeCell recibe el estado final real
                        const visual = window.TurnosRules ? window.TurnosRules.describeCell(resolved) : { label: resolved.turno };
                        daysMap[c.date] = {
                            label: visual.label || resolved.turno || '',
                            code: resolved.turno || '',
                            icons: visual.icon ? [visual.icon] : (resolved.icon ? [resolved.icon] : []),
                            estado: (resolved.isAbsent || resolved.incidencia) ? 'ausente' : 'operativo',
                            origen: resolved.incidencia || resolved.origen || 'base',
                            titular_cubierto: resolved.titular || null,
                            sustituto: resolved.sustituidoPor || null
                        };
                    });
                    return {
                        nombre: employee.nombre || employee.employee_id,
                        empleado_id: employee.employee_id,
                        orden: idx + 1,
                        dias: daysMap
                    };
                })
            };
            window._lastRenderedPreviewSnapshotSource.hoteles.push(hotelSnapshot);

            const renderEmployeeTable = true;

            if (renderEmployeeTable) {
                const hotelSection = document.createElement('div');
                hotelSection.innerHTML = `
                <div class="glass-panel" style="margin-bottom:3rem; padding:0; overflow:hidden; border:1px solid #e2e8f0; background:white; border-radius:16px;">
                    <div style="padding:18px 25px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:15px; background:#f8fafc;">
                        <img src="${hName.toLowerCase().includes('guadiana') ? 'guadiana logo.jpg' : 'cumbria logo.jpg'}" style="width:38px; height:38px; object-fit:contain;">
                        <h2 style="margin:0; font-size:1.1rem; color:#1e293b; font-weight:800;">${hName} <span style="color:#94a3b8; font-size:0.85rem;">${isWeekly ? `Semana ${window.fmtDateLegacy(startISO)}` : `${window.fmtDateLegacy(startISO)} - ${window.fmtDateLegacy(endISO)}`}</span></h2>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="preview-table-premium" style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:15px 25px; text-align:left; border-bottom:1px solid #f1f5f9; width:220px; color:#64748b; font-size:0.7rem; text-transform:uppercase; position:sticky; left:0; background:#f8fafc; z-index:10;">Empleado</th>
                                    ${columns.map(c => `<th style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:145px; border-left:1px solid #f1f5f9;"><div style="font-size:0.65rem; color:#94a3b8;">${c.dayName}</div><div style="font-size:0.75rem; font-weight:600;">${c.dayDisplay.toLowerCase()}</div></th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${deduplicatedList.map(employee => `
                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:12px 25px; background:white; position:sticky; left:0; z-index:5; border-right:1px solid #f1f5f9;">
                                            ${window.renderEmpleadoRowHeader(employee, { showVacationIcon: true })}
                                        </td>
                                        ${columns.map(c => `<td style="padding:8px; text-align:center; border-left:1px solid #f1f5f9;">${window.renderEmpleadoCell(previewModel.getTurnoEmpleado(employee.employee_id, c.date))}</td>`).join('')}
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
    if (excelMonth && !excelMonth.value) excelMonth.value = window.isoDate(new Date()).slice(0, 7);
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
            baseIndex: window._lastBaseIndex || null
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
    const d = new Date(date);
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
    if (key.includes('sust')) return { label: 'Sustituto', cls: 'sustituto', rank: 2 };
    if (key.includes('ocas') || key.includes('apoyo')) return { label: 'Ocasional', cls: 'ocasional', rank: 3 };
    return { label: 'Activo', cls: 'activo', rank: 1 };
};

window.buildEmployeeLineModel = (empleado) => {
    const profile = empleado?.profile || {};
    const stats = empleado?.stats || {};
    const todayISO = empleado?.todayISO || window.isoDate(new Date());
    const events = Array.isArray(empleado?.eventos) ? empleado.eventos : [];
    const history = Array.isArray(stats.history) ? [...stats.history].sort((a, b) => a.fecha.localeCompare(b.fecha)) : [];
    const todayShift = history.find(h => h.fecha === todayISO) || null;
    const nextShift = history.find(h => h.fecha > todayISO && ['m', 't', 'n', 'd'].includes(h.cls)) || null;
    const id = profile.id || stats.id || stats.emp || '';
    const nombre = profile.nombre || stats.emp || id || 'Empleado';
    const tipoRaw = profile.tipo_personal || profile.contrato || 'Fijo';
    const tipoNorm = window.employeeNorm(tipoRaw);
    const activeEvents = events.filter(ev => {
        const start = String(ev.fecha_inicio || '').slice(0, 10);
        const end = String(ev.fecha_fin || start || '').slice(0, 10);
        return (ev.estado || 'activo') !== 'anulado' && start && start <= todayISO && todayISO <= end;
    });
    const activeAbsences = activeEvents.filter(ev => /VAC|BAJA|PERM/i.test(String(ev.tipo || '')));
    const activeChanges = activeEvents.filter(ev => /CAMBIO|INTERCAMBIO|REFUERZO/i.test(String(ev.tipo || '')));
    const isSubstitute = Boolean(todayShift?.cell?.real && todayShift?.cell?.titular && todayShift.cell.real !== todayShift.cell.titular)
        || tipoNorm.includes('sust');

    let estado = profile.activo === false || window.employeeNorm(profile.estado_empresa).includes('baja') ? 'Baja' : 'Activo';
    if (todayShift?.cls === 'v' || activeAbsences.some(ev => /VAC/i.test(ev.tipo || ''))) estado = 'Vacaciones';
    else if (todayShift?.cls === 'b' || activeAbsences.some(ev => /BAJA|PERM/i.test(ev.tipo || ''))) estado = 'Baja';
    else if (isSubstitute) estado = 'Sustituto';
    else if (tipoNorm.includes('ocas') || tipoNorm.includes('apoyo')) estado = 'Ocasional';

    const bajas = (stats.b || 0) + (stats.p || 0);
    const ajusteVac = Number(profile.ajuste_vacaciones_dias || 0);

    return {
        id,
        nombre,
        hotel: stats.hotel || profile.hotel_id || profile.hotel || 'Sin hotel',
        puesto: profile.puesto || profile.categoria || 'Personal',
        tipo: tipoRaw,
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
        activeEvents
    };
};

window.renderEmployeeLine = (line) => {
    const status = window.employeeStatusMeta(line.estado);
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
            <span class="el-pill type">${escapeHtml(line.tipo || 'Fijo')}</span>
            <span class="emp-line-status emp-line-status-${status.cls}">${escapeHtml(status.label)}</span>
            <span>${line.turnoHoy ? window.employeeShiftBadge(line.turnoHoy.turno, line.turnoHoy.cambio ? '�x' : '') : window.employeeShiftBadge('')}</span>
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
    const q = window.employeeNorm(filters.search);
    let lines = [...window._employeeLineModels].filter(line => {
        if (filters.hotel !== 'all' && line.hotel !== filters.hotel) return false;
        if (filters.estado !== 'all') {
            if (filters.estado === 'operativo' && line.estado === 'Baja') return false;
            if (filters.estado !== 'operativo' && line.estado !== filters.estado) return false;
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
    const stateOptions = ['operativo', 'Activo', 'Vacaciones', 'Baja', 'Ocasional', 'Sustituto', 'all'];
    area.innerHTML = `
        <div class="employees-dashboard line-mode">
            <div class="ed-summary">
                <div><span>Filas visibles</span><strong>${lines.length}</strong></div>
                <div><span>Activos</span><strong>${lines.filter(l => l.estado === 'Activo').length}</strong></div>
                <div><span>Incidencias</span><strong>${lines.filter(l => l.estado !== 'Activo').length}</strong></div>
            </div>
            <div class="ed-tools">
                <input id="empLineSearch" type="search" value="${escapeHtml(filters.search)}" placeholder="Buscar nombre o ID">
                <select id="empLineHotel"><option value="all">Todos los hoteles</option>${hotels.map(h => `<option value="${escapeHtml(h)}" ${filters.hotel === h ? 'selected' : ''}>${escapeHtml(window.employeeShortHotel(h))}</option>`).join('')}</select>
                <select id="empLineEstado">${stateOptions.map(s => `<option value="${escapeHtml(s)}" ${filters.estado === s ? 'selected' : ''}>${escapeHtml(s === 'all' ? 'Todos los estados' : s === 'operativo' ? 'Operativo sin bajas' : s)}</option>`).join('')}</select>
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
        </div>
        <div class="employees-line-table advanced">
            <div class="emp-line-header advanced">
                <span>ID</span><span>Nombre</span><span>Hotel</span><span>Puesto</span><span>Tipo</span><span>Estado</span><span>Hoy</span><span>Proximo</span><span>Acciones</span>
            </div>
            ${lines.length ? lines.map(window.renderEmployeeLine).join('') : '<div class="employees-empty-line">No hay empleados para los filtros actuales.</div>'}
        </div>
    `;
    $('#empLineSearch')?.addEventListener('input', (e) => { window._employeeLineFilters.search = e.target.value; window.renderEmployeeLineRows(); });
    $('#empLineHotel')?.addEventListener('change', (e) => { window._employeeLineFilters.hotel = e.target.value; window.renderEmployeeLineRows(); });
    $('#empLineEstado')?.addEventListener('change', (e) => { window._employeeLineFilters.estado = e.target.value; window.renderEmployeeLineRows(); });
    $('#empLineSort')?.addEventListener('change', (e) => { window._employeeLineFilters.sort = e.target.value; window.renderEmployeeLineRows(); });
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
window.detectarConflictosOperativos = async (fecha, hotel) => {
    const groupedConflicts = {
        CRITICAL: [],
        WARNING: [],
        INFO: []
    };
    
    const emps = (window._employeeLineModels || []).filter(e => e.activo !== false && (hotel === 'TODOS' || e.hotel === hotel));
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
            action: { label: 'Ir a Personal', fn: 'window.switchSection("personal")' }
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
            eventos: emp.events
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
    const changes = window.getExcelDiff();
    
    // Si no hay cambios, permitimos publicar el estado actual de la vista previa
    if (changes.length === 0) {
        const isPreview = document.getElementById('section-preview').classList.contains('active');
        if (!isPreview) {
            alert('No hay cambios locales pendientes de publicar. Selecciona una semana en "Vista Previa" para publicar un snapshot.');
            return;
        }
        if (!confirm('No hay cambios locales en el Excel. ¿Deseas generar y publicar un nuevo snapshot con el estado actual de la semana visible?')) {
            return;
        }
    }

    const affectedEmps = new Set(changes.map(c => c.displayName));
    const hotelCounts = {};
    changes.forEach(c => {
        hotelCounts[c.hotel] = (hotelCounts[c.hotel] || 0) + 1;
    });

    // Crear Modal de Previsualización
    const modalId = 'publishPreviewModal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'drawer-overlay';
        modal.style.zIndex = '9999';
        document.body.appendChild(modal);
    }

    const hotelSummary = Object.entries(hotelCounts).map(([h, count]) => `<li><strong>${h}:</strong> ${count} filas</li>`).join('');

    modal.innerHTML = `
        <div class="drawer-content" style="max-width: 800px; padding: 0; border-radius: 24px; overflow: hidden; background: #f8fafc;">
            <header style="padding: 24px 32px; background: #0f172a; color: white;">
                <h2 style="margin: 0; font-size: 1.25rem;">�xa� Publicar cambios en Supabase</h2>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.8;">Revisa las diferencias antes de confirmar la subida definitiva.</p>
            </header>
            
            <div style="padding: 32px; overflow-y: auto; max-height: 70vh;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px;">
                    <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <span style="font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Resumen de Cambios</span>
                        <div style="font-size: 2rem; font-weight: 900; color: #0f172a; margin: 8px 0;">${changes.length}</div>
                        <div style="font-size: 0.85rem; color: #64748b;">Filas de Excel modificadas localmente.</div>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <span style="font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Alcance</span>
                        <div style="font-size: 2rem; font-weight: 900; color: #3b82f6; margin: 8px 0;">${affectedEmps.size}</div>
                        <div style="font-size: 0.85rem; color: #64748b;">Empleados afectados por la actualización.</div>
                    </div>
                </div>

                <section style="margin-bottom: 32px;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        ${window.employeeIcon('hotel')} Distribución por Hotel
                    </h3>
                    <ul style="margin: 0; padding: 0 0 0 20px; font-size: 0.9rem; color: #334155;">
                        ${hotelSummary}
                    </ul>
                </section>

                <section>
                    <h3 style="font-size: 0.9rem; font-weight: 800; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        ${window.employeeIcon('calendar')} Detalle de Modificaciones
                    </h3>
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                            <thead>
                                <tr style="background: #f1f5f9; text-align: left;">
                                    <th style="padding: 12px; border-bottom: 1px solid #e2e8f0;">Semana</th>
                                    <th style="padding: 12px; border-bottom: 1px solid #e2e8f0;">Empleado</th>
                                    <th style="padding: 12px; border-bottom: 1px solid #e2e8f0;">Cambios</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${changes.slice(0, 50).map(c => `
                                    <tr>
                                        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b;">${c.weekStart}</td>
                                        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${c.displayName}</td>
                                        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9;">
                                            ${c.nameChanged ? '<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">NOMBRE</span> ' : ''}
                                            ${c.shiftsChanged ? '<span style="background: #f0fdf4; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">TURNOS</span>' : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                                ${changes.length > 50 ? `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8; font-style: italic;">... y ${changes.length - 50} cambios más.</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <footer style="padding: 24px 32px; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px;">
                <button onclick="document.getElementById('${modalId}').classList.remove('open')" style="padding: 12px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; font-weight: 700; cursor: pointer; color: #64748b;">Cancelar</button>
                <button id="btnConfirmPublish" onclick="window.publishToSupabase()" style="padding: 12px 32px; border: none; border-radius: 12px; background: #3b82f6; color: white; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">Confirmar y Publicar</button>
            </footer>
        </div>
    `;

    modal.classList.add('open');
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
            if (vNorm && !validShifts.has(vNorm) && !vNorm.includes('�x�️')) {
                // Permitimos valores que no estén en el set si son descriptivos, 
                // pero alertamos si parecen basura
                if (vNorm.length > 10) errors.push(`Turno sospechoso en ${c.weekStart} (${c.displayName}): ${vNorm}`);
            }
        });
    });

    return errors;
};

    /**
     * TAREA CODEX: Función de diagnóstico para validar qué está viendo Admin
     * y asegurar que el Snapshot sea una copia fiel.
     */
    window.debugPublishedPreviewSource = () => {
        const result = { hotels: [] };
        if (!window._previewPuestosModels) return result;
        
        for (const [pId, model] of Object.entries(window._previewPuestosModels)) {
            if (result.hotels.find(h => h.hotel === model.hotel)) continue;
            
            const emps = model.getEmployees();
            result.hotels.push({
                hotel: model.hotel,
                empleados: emps.map(e => e.nombre || e.id),
                rawModel: model
            });
        }
        return result;
    };

    /**
     * TAREA CODEX: Comparador fuerte para evitar publicar cuadrantes vacíos o erróneos.
     */
    window.comparePreviewVsSnapshot = (previewModel, snapshot) => {
        const snapEmps = snapshot.empleados || [];
        const previewEmps = previewModel.getEmployees();
        
        // 1. Validar número de empleados (deduplicados)
        const seen = new Set();
        const deduplicatedPreview = previewEmps.filter(e => {
            if (seen.has(e.employee_id)) return false;
            seen.add(e.employee_id);
            return true;
        });

        if (snapEmps.length !== deduplicatedPreview.length) {
            console.error(`[VALIDACIÓN] Desajuste en número de filas. Preview: ${deduplicatedPreview.length}, Snapshot: ${snapEmps.length}`);
            return false;
        }

        // 2. Validar contenido celda por celda
        for (let i = 0; i < deduplicatedPreview.length; i++) {
            const pEmp = deduplicatedPreview[i];
            const sEmp = snapEmps[i];
            const pName = pEmp.nombre || pEmp.employee_id;
            
            if (sEmp.nombre !== pName) {
                console.error(`[VALIDACIÓN] Desajuste en orden/nombre fila ${i+1}. Esperado: ${pName}, Snapshot: ${sEmp.nombre}`);
                return false;
            }

            // Validar que el snapshot no tenga días vacíos si el modelo tiene turnos
            for (const [fecha, dia] of Object.entries(sEmp.dias)) {
                if (!dia.label && !dia.code) {
                    const resolved = previewModel.getTurnoEmpleado(pEmp.employee_id, fecha);
                    if (resolved && resolved.turno) {
                        console.error(`[VALIDACIÓN CRITICAL] Celda vacía en snapshot para ${pName} el ${fecha}. Admin tiene: ${resolved.turno}`);
                        return false;
                    }
                }
            }
        }
        return true;
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

        // --- 1. VALIDACI�N PRE-PUBLICACI�N Y CONFLICTOS ---
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
            empleados_afectados: affectedEmps.size,
            resumen_json: {
                hoteles: Array.from(new Set(changes.map(c => c.hotel))),
                rango: {
                    inicio: changes[0].weekStart,
                    fin: changes[changes.length - 1].weekStart
                }
            },
            cambios_detalle_json: traceabilityDetails,
            estado: 'ok'
        });

        // --- 4. GENERAR Y GUARDAR SNAPSHOTS FINALES (ARQUITECTURA FIJA v12.0) ---
        // Admin resuelve la operativa completa y guarda el resultado horneado.
        if (btn) btn.textContent = 'Horneando snapshots finales...';
        
        let weeksAffected = Array.from(new Set(changes.map(c => c.weekStart)));
        let hotelsAffected = Array.from(new Set(changes.map(c => c.hotel)));

        // Si es publicación forzada (sin cambios), usamos la semana visible
        if (weeksAffected.length === 0) {
            const rawDate = document.getElementById('prevWeekDate')?.value;
            if (rawDate) {
                const base = new Date(rawDate + 'T12:00:00');
                weeksAffected = [window.isoDate(window.getMonday(base))];
            }
        }
        
        // Si no hay hoteles afectados específicos, publicamos todos los disponibles
        if (hotelsAffected.length === 0) {
            hotelsAffected = await window.TurnosDB.getHotels();
        }

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
                                const visual = window.TurnosRules ? window.TurnosRules.describeCell(resolved) : { label: resolved.turno };
                                daysMap[fecha] = {
                                    label: visual.label || resolved.turno || '',
                                    code: resolved.turno || '',
                                    icons: visual.icon ? [visual.icon] : (resolved.icon ? [resolved.icon] : []),
                                    estado: (resolved.isAbsent || resolved.incidencia) ? 'ausente' : 'operativo',
                                    origen: resolved.incidencia || resolved.origen || 'base',
                                    titular_cubierto: resolved.titular || null,
                                    sustituto: resolved.sustituidoPor || null
                                };
                            });
                            const profile = profiles.find(p => window.normalizeId(p.id) === window.normalizeId(emp.employee_id) || window.normalizeId(p.nombre) === window.normalizeId(emp.employee_id));
                            return {
                                nombre: emp.nombre || emp.employee_id,
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

        const conflicts = await window.detectarConflictosOperativos(today, 'TODOS');
        const changes = window.getExcelDiff ? window.getExcelDiff() : [];

        // --- BLOQUE A: ESTADO DEL SISTEMA ---
        const activeEmps = (empleados || []).filter(e => e.activo !== false && e.id !== '¿?');
        const totalEmps = activeEmps.length;
        const empsConId = activeEmps.filter(e => e.id_interno && String(e.id_interno).trim() !== '').length;
        const integrity = totalEmps > 0 ? Math.round((empsConId / totalEmps) * 100) : 100;

        $('#stat-cloud-status').textContent = 'Conectado';
        $('#stat-last-sync').textContent = new Date().toLocaleTimeString();
        $('#stat-pending-diff').textContent = changes.length;
        $('#stat-integrity-score').textContent = `${integrity}%`;

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
                            <button class="alert-btn primary" onclick="${r.action ? r.action.fn : (r.empId ? `window.openEmpDrawer('${r.empId}')` : `window.switchSection('preview')`)}">
                                ${r.action ? r.action.label : 'Ver Detalle'}
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Badges
        $('#count-critical').textContent = `${counts.critical} Críticos`;
        $('#count-warning').textContent = `${counts.warning} Avisos`;
        $('#count-info').textContent = `${counts.info} Info`;

        // --- BLOQUE C: ACCIONES RÁPIDAS ---
        // (Se asume que el HTML tiene un contenedor para esto o se inyecta)

        // --- BLOQUE D: ACTIVIDAD / AUDITORÍA ---
        const timeline = $('#dashboard-timeline');
        if (timeline) {
            try {
                const logs = await window.TurnosDB.fetchLogs(15);
                if (!logs || logs.length === 0) {
                    timeline.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.5; font-size:0.8rem;">Sin actividad reciente.</div>';
                } else {
                    timeline.innerHTML = logs.map(log => `
                        <div class="activity-log-item ${log.revertida ? 'warn' : 'ok'}">
                            <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(log.fecha).toLocaleTimeString()}</div>
                            <div style="font-weight:700;">${log.revertida ? 'Publicación Revertida' : 'Sincronización Cloud'}</div>
                            <div style="font-size:0.7rem;">${log.cambios_totales} turnos actualizados por ${log.usuario || 'Admin'}</div>
                            ${log.revertida ? '' : `<button class="btn-text" style="font-size:0.6rem; color:var(--error); margin-top:4px;" onclick="window.revertirPublicacion('${log.id}')">Revertir</button>`}
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error('[AUDITORIA ERROR]', err);
                timeline.innerHTML = '<div style="padding:20px; text-align:center; color:var(--error); font-size:0.8rem;">Auditoría no disponible. Revisa publicaciones_log.</div>';
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
        // Debounce simple para no refrescar por cada micro-cambio en bulk
        if (window._dashRefreshTimer) clearTimeout(window._dashRefreshTimer);
        window._dashRefreshTimer = setTimeout(window.renderDashboard, 1000);
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.renderDashboard, 1000);
    if (window.TurnosDB?.initRealtime) window.TurnosDB.initRealtime();
    
    // Polling de badges cada 30s (más el tiempo real si está activo)
    window.updateSidebarBadges();
    setInterval(window.updateSidebarBadges, 30000);
});

