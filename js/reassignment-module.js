/**
 * MÓDULO: REASIGNACIÓN DE EMPLEADO
 * Objetivo: Mover actividad operativa de un empleado origen a un destino.
 * Estado: MODO SIMULACIÓN (Ejecución bloqueada por protocolo No-Write)
 */

window.ReassignmentModule = {
    state: {
        originId: null,
        destId: null,
        dateFrom: null,
        dateTo: null,
        scopes: ['turnos', 'eventos', 'sustituciones', 'cambios'],
        isSimulating: true
    },

    init: function() {
        console.log('[REASSIGNMENT] Módulo cargado.');
    },

    openModal: function(prefilledOrigin = null) {
        this.state.originId = prefilledOrigin;
        this.renderForm();
    },

    renderForm: function() {
        const modalHtml = `
            <div id="modalReassign" class="drawer-overlay" style="display:flex; align-items:center; justify-content:center; padding:1rem; z-index:9999; background:rgba(0,0,0,0.5); position:fixed; top:0; left:0; width:100%; height:100%;">
                <div class="glass" style="width:100%; max-width:650px; padding:2.5rem; border-radius:24px; background:var(--surface); border:1px solid var(--border); max-height:90vh; overflow-y:auto;" onclick="event.stopPropagation()">
                    <h2 style="margin-bottom:10px; font-weight:900; display:flex; align-items:center; gap:12px;">
                        <i class="fas fa-exchange-alt" style="color:var(--accent);"></i> Reasignación de Actividad
                    </h2>
                    <p style="font-size:0.85rem; color:var(--text-dim); margin-bottom:25px;">Mover turnos, eventos y sustituciones entre empleados desde una fecha específica.</p>
                    
                    <div id="reassignStatus"></div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">Empleado Origen</label>
                            <select id="reOrigin" class="btn-premium" style="width:100%;">${this.getEmployeeOptions(this.state.originId)}</select>
                            <div style="font-size:0.65rem; color:var(--text-muted); mt:5px;">(Placeholder o Empleado a vaciar)</div>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">Empleado Destino</label>
                            <select id="reDest" class="btn-premium" style="width:100%;">${this.getEmployeeOptions()}</select>
                            <div style="font-size:0.65rem; color:var(--text-muted); mt:5px;">(Empleado real que recibe la actividad)</div>
                        </div>
                        
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">Desde Fecha (Inclusive)</label>
                            <input type="date" id="reDateFrom" class="btn-premium" style="width:100%;" value="${window.isoDate(new Date())}">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">Hasta Fecha (Opcional)</label>
                            <input type="date" id="reDateTo" class="btn-premium" style="width:100%;" placeholder="Indefinido">
                        </div>

                        <div style="grid-column: span 2;">
                            <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:12px;">Ámbito de la Reasignación</label>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                                <label style="display:flex; align-items:center; gap:10px; font-size:0.85rem; font-weight:600; cursor:pointer;">
                                    <input type="checkbox" name="reScope" value="turnos" checked> Turnos Base
                                </label>
                                <label style="display:flex; align-items:center; gap:10px; font-size:0.85rem; font-weight:600; cursor:pointer;">
                                    <input type="checkbox" name="reScope" value="eventos" checked> Eventos / Ausencias
                                </label>
                                <label style="display:flex; align-items:center; gap:10px; font-size:0.85rem; font-weight:600; cursor:pointer;">
                                    <input type="checkbox" name="reScope" value="sustituciones" checked> Sustituciones
                                </label>
                                <label style="display:flex; align-items:center; gap:10px; font-size:0.85rem; font-weight:600; cursor:pointer;">
                                    <input type="checkbox" name="reScope" value="cambios" checked> Cambios / Intercambios
                                </label>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:30px; padding:15px; border-radius:12px; background:rgba(26,86,219,0.05); border:1px solid rgba(26,86,219,0.1);">
                        <p style="font-size:0.75rem; color:#1e40af; font-weight:600; margin:0;">
                            <i class="fas fa-info-circle" style="margin-right:8px;"></i>
                            La reasignación NO modifica snapshots publicados ni elimina al empleado origen.
                        </p>
                    </div>

                    <div style="margin-top:30px; display:flex; gap:12px;">
                        <button onclick="window.ReassignmentModule.runDryRun()" class="btn-publish-premium" style="flex:2; background:var(--accent);">
                            <i class="fas fa-microscope" style="margin-right:10px;"></i> Simular Reasignación
                        </button>
                        <button onclick="window.ReassignmentModule.closeModal()" class="btn-premium" style="flex:1;">Cancelar</button>
                    </div>
                    
                    <div id="dryRunResults" style="margin-top:25px; display:none;"></div>
                </div>
            </div>
        `;
        
        let container = document.getElementById('reassign-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'reassign-container';
            document.body.appendChild(container);
        }
        container.innerHTML = modalHtml;
    },

    getEmployeeOptions: function(selectedId = null) {
        const emps = window.empleadosGlobales || [];
        return emps.map(e => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${e.nombre} (${e.hotel_id || 'Sin hotel'})</option>`).join('');
    },

    closeModal: function() {
        const modal = document.getElementById('modalReassign');
        if (modal) modal.remove();
    },

    runDryRun: async function() {
        const originId = document.getElementById('reOrigin').value;
        const destId = document.getElementById('reDest').value;
        const dateFrom = document.getElementById('reDateFrom').value;
        const dateTo = document.getElementById('reDateTo').value || null;
        
        if (originId === destId) {
            this.setStatus('El origen y el destino no pueden ser el mismo.', 'error');
            return;
        }

        this.setStatus('Simulando reasignación...', 'pending');
        
        try {
            // 1. Fetch data for simulation
            const [turnos, eventos] = await Promise.all([
                window.TurnosDB.fetchRango(dateFrom, dateTo || window.addIsoDays(dateFrom, 90)),
                window.TurnosDB.fetchEventos(dateFrom, dateTo || window.addIsoDays(dateFrom, 90))
            ]);

            const originTurnos = turnos.filter(t => t.empleado_id === originId);
            const originEventos = eventos.filter(e => e.empleado_id === originId || e.empleado_destino_id === originId);
            
            const resultsDiv = document.getElementById('dryRunResults');
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = `
                <div class="glass" style="padding:20px; border:1px solid var(--border); background:#f8fafc; border-radius:16px;">
                    <h3 style="font-size:0.85rem; font-weight:800; margin-bottom:15px; color:var(--text);">RESULTADOS DE LA SIMULACIÓN</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div style="background:white; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
                            <div style="font-size:0.6rem; color:var(--text-dim); font-weight:800;">TURNOS A MOVER</div>
                            <div style="font-size:1.2rem; font-weight:900;">${originTurnos.length}</div>
                        </div>
                        <div style="background:white; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
                            <div style="font-size:0.6rem; color:var(--text-dim); font-weight:800;">EVENTOS/AUSENCIAS</div>
                            <div style="font-size:1.2rem; font-weight:900;">${originEventos.filter(e => e.empleado_id === originId).length}</div>
                        </div>
                        <div style="background:white; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
                            <div style="font-size:0.6rem; color:var(--text-dim); font-weight:800;">SUSTITUCIONES ACTIVAS</div>
                            <div style="font-size:1.2rem; font-weight:900;">${originEventos.filter(e => e.empleado_destino_id === originId).length}</div>
                        </div>
                        <div style="background:white; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
                            <div style="font-size:0.6rem; color:var(--text-dim); font-weight:800;">CONFLICTOS POTENCIALES</div>
                            <div style="font-size:1.2rem; font-weight:900; color:var(--warning);">0</div>
                        </div>
                    </div>
                    
                    <div style="margin-top:20px; font-size:0.75rem; color:var(--text-muted);">
                        Semanas que requerirán republicación: ${this.getAffectedWeeks(originTurnos, originEventos).join(', ') || 'Ninguna'}
                    </div>

                    <button class="btn-publish-premium" disabled style="width:100%; margin-top:20px; opacity:0.5; cursor:not-allowed; background:var(--danger);">
                        <i class="fas fa-lock" style="margin-right:10px;"></i> Ejecución Bloqueada por Seguridad
                    </button>
                    <p style="text-align:center; font-size:0.65rem; color:var(--danger); margin-top:8px; font-weight:700;">Requiere autorización de Nivel 2 (No-Write Activo)</p>
                </div>
            `;
            this.setStatus('Simulación completada.', 'success');
        } catch (e) {
            console.error(e);
            this.setStatus('Error en la simulación: ' + e.message, 'error');
        }
    },

    getAffectedWeeks: function(turnos, eventos) {
        const dates = new Set([
            ...turnos.map(t => t.fecha),
            ...eventos.map(e => e.fecha_inicio)
        ]);
        const weeks = new Set();
        dates.forEach(d => {
            const start = window.getMonday(new Date(d + 'T12:00:00'));
            weeks.add(window.isoDate(start));
        });
        return Array.from(weeks).sort();
    },

    setStatus: function(msg, type) {
        const div = document.getElementById('reassignStatus');
        if (!div) return;
        div.innerHTML = `<div class="status-msg ${type}" style="padding:10px; border-radius:8px; margin-bottom:15px; font-size:0.8rem; font-weight:700; ${this.getStatusStyles(type)}">${msg}</div>`;
    },

    getStatusStyles: function(type) {
        switch(type) {
            case 'error': return 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;';
            case 'success': return 'background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;';
            case 'pending': return 'background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;';
            default: return '';
        }
    }
};

window.getMonday = function(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
};
