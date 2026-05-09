/**
 * MÓDULO: CAMBIOS DE TURNO (V12.5.23)
 * Extracto de lógica operativa de cambios desde admin.js
 */
(function() {
    'use strict';

    const CambiosModule = {
        init: () => {
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
                            CambiosModule.renderChanges();
                        }
                    }
                });
            }

            if (!rangeInput.dataset.changeBound) {
                rangeInput.addEventListener('change', () => CambiosModule.renderChanges());
                rangeInput.dataset.changeBound = '1';
            }
        },

        loadChanges: async () => {
            return await window.TurnosDB.fetchEventos();
        },

        validateChangeIntegrity: (ev, context) => {
            const { intercambiosMap } = context || { intercambiosMap: new Set() };
            let label = 'OK';
            let cls = 'status-ok';
            
            const tOrig = ev.turno_original || ev.turno_origen;
            const tDest = ev.turno_nuevo || ev.turno_destino;
            const hasLegacy = window.isInvalidLegacyChangeValue?.(tOrig) || window.isInvalidLegacyChangeValue?.(tDest);
            const isDuplicate = ev.tipo === 'CAMBIO_TURNO' && intercambiosMap.has(`${ev.fecha_inicio}|${ev.empleado_id}|${ev.empleado_destino_id}`);

            if (isDuplicate) {
                label = 'DUPLICADO IGNORADO';
                cls = 'status-warning';
            } else if (hasLegacy) {
                const canReconstruct = (ev.empleado_id && (ev.empleado_destino_id || ev.tipo !== 'INTERCAMBIO_TURNO'));
                label = canReconstruct ? 'LEGACY CT / RECONSTRUIDO' : 'LEGACY CT / INCOMPLETO';
                cls = canReconstruct ? 'status-info' : 'status-danger';
            }
            return { label, cls };
        },

        renderChanges: async () => {
            try {
                const tableBody = document.getElementById('changes-body');
                const upcomingList = document.getElementById('upcoming-changes-list');
                if (!tableBody) return;
                
                CambiosModule.init();

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
                    } finally {
                        window._syncingApprovedChangeRequests = false;
                    }
                }

                const changeSource = events || [];
                const hotelSel = document.getElementById('chHotel');
                if (hotelSel && hotelSel.options.length <= 1) {
                    hotels.forEach(h => {
                        const opt = document.createElement('option');
                        opt.value = h; opt.textContent = h;
                        hotelSel.appendChild(opt);
                    });
                }

                const search = (document.getElementById('chSearch')?.value || '').toLowerCase();
                const selHotel = document.getElementById('chHotel')?.value || 'all';
                const selType = document.getElementById('chType')?.value || 'all';
                const selStatus = document.getElementById('chStatus')?.value || 'activo';
                
                let filtered = changeSource.filter(ev => ['CAMBIO_TURNO', 'INTERCAMBIO_TURNO', 'INTERCAMBIO_HOTEL', 'EVENTO_INTERCAMBIO', 'EVENTO_CAMBIO_HOTEL', 'INTERCAMBIO_MANUAL'].includes(ev.tipo));
                
                const now = new Date();
                const isoNow = window.isoDate(now);
                const next365 = window.isoDate(new Date(now.getTime() + 365 * 86400000));
                const rangeVal = (document.getElementById('chRange')?.value || '').trim();

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

                if (document.getElementById('ch-stat-total')) document.getElementById('ch-stat-total').textContent = activos;
                if (document.getElementById('ch-stat-30d')) document.getElementById('ch-stat-30d').textContent = p30d;
                if (document.getElementById('ch-stat-emps')) document.getElementById('ch-stat-emps').textContent = affectedSet.size;

                const shiftLabel = (value) => {
                    if (window.isInvalidLegacyChangeValue?.(value)) return '—';
                    const raw = String(value || '').trim();
                    if (!raw) return '—';
                    const norm = window.normalizeShiftValue ? window.normalizeShiftValue(raw) : raw;
                    if (norm === 'M') return 'Mañana';
                    if (norm === 'T') return 'Tarde';
                    if (norm === 'N') return 'Noche';
                    if (norm === 'D') return 'Descanso';
                    return raw;
                };
                const shiftClass = (value) => {
                    const norm = window.normalizeShiftValue ? window.normalizeShiftValue(value) : value;
                    if (norm) return norm.toLowerCase();
                    return 'x';
                };
                const shiftChip = (value) => `<span class="turno-pill-mini ${shiftClass(value)}" style="width:auto; min-width:58px; height:auto; padding:4px 8px; font-size:0.65rem;">${shiftLabel(value)}</span>`;
                const firstNonLegacyShift = (...values) => {
                    for (const v of values) {
                        if (v === undefined || v === null) continue;
                        const raw = String(v).trim();
                        if (!raw) continue;
                        if (window.isInvalidLegacyChangeValue?.(raw)) continue;
                        return raw;
                    }
                    return '';
                };
                const changeDetail = (ev) => {
                    const original = firstNonLegacyShift(
                        ev.turno_original,
                        ev.turno_origen,
                        ev.payload?.turno_original,
                        ev.payload?.turno_origen,
                        ev.payload?.origen,
                        ev.payload?.original_data?.turno_original,
                        ev.payload?.original_data?.turno_origen,
                        ev.payload?.original_data?.origen
                    );
                    const requested = firstNonLegacyShift(
                        ev.turno_nuevo,
                        ev.turno_destino,
                        ev.payload?.turno_nuevo,
                        ev.payload?.turno_destino,
                        ev.payload?.destino,
                        ev.payload?.original_data?.turno_nuevo,
                        ev.payload?.original_data?.turno_destino,
                        ev.payload?.original_data?.destino
                    );
                    if (!original && !requested) return '<span style="color:#94a3b8; font-size:0.75rem; font-weight:700;">Sin detalle</span>';
                    return `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">${shiftChip(original)}<span style="color:#94a3b8; font-weight:900;">→</span>${shiftChip(requested)}</div>`;
                };

                const intercambiosMap = new Set(filtered.filter(ev => ev.tipo === 'INTERCAMBIO_TURNO').map(ev => `${ev.fecha_inicio}|${ev.empleado_id}|${ev.empleado_destino_id}`));

                tableBody.innerHTML = filtered.map(ev => {
                    const dateFmt = window.fmtDateLegacy ? window.fmtDateLegacy(ev.fecha_inicio) : ev.fecha_inicio;
                    const typeLabel = ev.tipo === 'CAMBIO_TURNO' ? 'CAMBIO PUNTUAL' : (ev.tipo === 'INTERCAMBIO_TURNO' ? 'INTERCAMBIO' : 'CAMBIO HOTEL');
                    const typeClass = ev.tipo === 'CAMBIO_TURNO' ? 'tag-info' : 'tag-warning';
                    
                    const integrity = CambiosModule.validateChangeIntegrity(ev, { intercambiosMap });
                    const isDuplicate = integrity.label === 'DUPLICADO IGNORADO';

                    return `
                        <tr style="border-bottom:1px solid #f1f5f9; transition:0.2s; ${isDuplicate ? 'opacity:0.6;' : ''}" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" ondblclick="window.CambiosModule.editChange('${ev.id}')" title="Doble clic para editar el cambio">
                            <td style="padding:15px; font-weight:700; color:#2563eb;">
                                <button type="button" onclick="event.stopPropagation(); window.CambiosModule.editChange('${ev.id}')" title="Editar cambio" style="border:0; background:transparent; color:#2563eb; font:inherit; font-weight:800; padding:0; cursor:pointer;">${dateFmt}</button>
                            </td>
                            <td style="padding:15px; font-size:0.85rem; color:#64748b;">${ev.hotel_origen || '—'}</td>
                            <td style="padding:15px;">
                                <div style="font-weight:800; font-size:0.9rem;">${ev.empleado_id} ${ev.empleado_destino_id ? '<span style="color:#94a3b8; font-weight:400; margin:0 4px;">↔</span> ' + ev.empleado_destino_id : ''}</div>
                            </td>
                            <td style="padding:15px;">${changeDetail(ev)}</td>
                            <td style="padding:15px;">
                                <span class="panel-tag ${typeClass}" style="font-size:0.6rem; letter-spacing:0.02em;">${typeLabel}</span>
                                <div class="integrity-badge ${integrity.cls}" style="font-size:0.55rem; margin-top:4px; font-weight:800;">${integrity.label}</div>
                            </td>
                            <td style="padding:15px; font-size:0.8rem; color:#64748b; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.observaciones || '—'}</td>
                            <td style="padding:15px; text-align:center;">
                                <div style="display:flex; gap:6px; justify-content:center;">
                                    <button class="btn-icon" onclick="window.CambiosModule.editChange('${ev.id}')" title="Gestionar"><i class="fas fa-edit"></i></button>
                                    <button class="btn-icon danger" onclick="window.CambiosModule.anularChange('${ev.id}')" title="Anular"><i class="fas fa-trash"></i></button>
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
                        <div style="font-weight:800; font-size:0.8rem; color:#1e293b;">${window.fmtDateLegacy ? window.fmtDateLegacy(ev.fecha_inicio) : ev.fecha_inicio} · ${ev.hotel_origen}</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${ev.empleado_id} ${ev.empleado_destino_id ? '↔ ' + ev.empleado_destino_id : ''}</div>
                        <div style="font-size:0.72rem; color:#475569; margin-top:6px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">${changeDetail(ev)}</div>
                    </div>
                `).join('') || '<div style="padding:10px; text-align:center; opacity:0.5; font-size:0.8rem;">No hay cambios próximos.</div>';
            } catch (err) {
                console.error('[CHANGES ERROR]', err);
                if (document.getElementById('changes-body')) document.getElementById('changes-body').innerHTML = '<tr><td colspan="7" style="padding:3rem; text-align:center; color:#b91c1c;">Error cargando cambios.</td></tr>';
            }
        },

        ensureChangeEditModal: () => {
            if (document.getElementById('changeEditModal')) return;
            const modal = document.createElement('div');
            modal.id = 'changeEditModal';
            modal.style.cssText = 'position:fixed; inset:0; z-index:9999; display:none; align-items:center; justify-content:center; background:rgba(15,23,42,0.55); backdrop-filter:blur(8px); padding:24px;';
            modal.innerHTML = `
                <form id="changeEditForm" onsubmit="window.CambiosModule.saveChangeEdit(event)" style="width:min(760px, calc(100vw - 40px)); max-height:calc(100vh - 48px); overflow:auto; background:#fff; border:1px solid #dbe6f3; border-radius:22px; box-shadow:0 24px 70px rgba(15,23,42,0.28);">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:22px 26px; border-bottom:1px solid #e2e8f0;">
                        <div>
                            <h3 style="margin:0; font-size:1.05rem; font-weight:900; color:#0f172a;">Editar cambio operativo</h3>
                            <p id="changeEditId" style="margin:5px 0 0; font-size:0.72rem; color:#64748b; font-weight:700;"></p>
                        </div>
                        <button type="button" onclick="window.CambiosModule.closeChangeEditModal()" style="width:42px; height:42px; border-radius:14px; border:1px solid #dbe6f3; background:#fff; color:#334155; font-size:1.3rem; cursor:pointer;">&times;</button>
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
                        <option value="">&mdash;</option><option value="M">Ma&ntilde;ana</option><option value="T">Tarde</option><option value="N">Noche</option><option value="D">Descanso</option>
                    </select>
                        </label>
                        <label style="display:grid; gap:7px; font-size:0.68rem; color:#64748b; font-weight:900; text-transform:uppercase;">Turno solicitado
                            <select id="edit-change-dest" style="height:48px; border:1px solid #d5e1ef; border-radius:14px; padding:0 14px; font-size:0.95rem; font-weight:700;">
                        <option value="">&mdash;</option><option value="M">Ma&ntilde;ana</option><option value="T">Tarde</option><option value="N">Noche</option><option value="D">Descanso</option>
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
                        <button type="button" onclick="window.CambiosModule.closeChangeEditModal()" class="btn-premium" style="min-height:44px;">Cancelar</button>
                        <button id="btnSaveChangeEdit" type="submit" class="btn-premium" style="min-height:44px; background:#2563eb; color:#fff; border-color:#2563eb;">Guardar cambio</button>
                    </div>
                </form>
            `;
            document.body.appendChild(modal);
        },

        closeChangeEditModal: () => {
            const modal = document.getElementById('changeEditModal');
            if (modal) modal.style.display = 'none';
            window._editingChangeEvent = null;
        },

        editChange: async (id) => {
            try {
                CambiosModule.ensureChangeEditModal();
                const [eventos, hotels] = await Promise.all([
                    window.TurnosDB.fetchEventos(),
                    window.TurnosDB.getHotels()
                ]);
                const ev = (eventos || []).find(item => String(item.id) === String(id));
                if (!ev) throw new Error('No se encontro el cambio seleccionado');
                window._editingChangeEvent = ev;

                const hotelSelect = document.getElementById('edit-change-hotel');
                hotelSelect.innerHTML = `<option value="">Sin hotel</option>${(hotels || []).map(h => `<option value="${window.escapeHtml(h)}">${window.escapeHtml(h)}</option>`).join('')}`;

                const setValue = (fieldId, value) => {
                    const field = document.getElementById(fieldId);
                    if (field) field.value = value || '';
                };
                const toShiftSelectValue = (value) => {
            const norm = window.normalizeShiftValue ? window.normalizeShiftValue(value) : String(value || '').trim().toUpperCase();
            if (norm === 'M') return 'M';
            if (norm === 'T') return 'T';
            if (norm === 'N') return 'N';
            if (norm === 'D') return 'D';
            return '';
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
        },

        saveChangeEdit: async (event) => {
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

                CambiosModule.closeChangeEditModal();
                await CambiosModule.renderChanges();
            } catch (err) {
                alert('Error guardando cambio: ' + err.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Guardar cambio';
                }
            }
        },

        anularChange: async (id) => {
            if (!confirm("¿Estás seguro de anular este cambio operativo?")) return;
            try {
                const eventos = await window.TurnosDB.fetchEventos();
                const evento = (eventos || []).find(ev => String(ev.id) === String(id));
                const peticionId = evento?.payload?.peticion_id;
                await window.TurnosDB.anularEvento(id);
                if (peticionId) await window.TurnosDB.actualizarEstadoPeticion(peticionId, 'anulada');
                alert("Cambio anulado correctamente.");
                CambiosModule.renderChanges();
            } catch (err) { alert("Error al anular: " + err.message); }
        },

        refresh: () => CambiosModule.renderChanges()
    };

    // Expose to window
    window.CambiosModule = CambiosModule;
    
    // Compatibility Layer
    window.renderChanges = CambiosModule.renderChanges;
    window.initChangesControls = CambiosModule.init;
    window.editChange = CambiosModule.editChange;
    window.saveChangeEdit = CambiosModule.saveChangeEdit;
    window.anularChange = CambiosModule.anularChange;
    window.closeChangeEditModal = CambiosModule.closeChangeEditModal;

})();
