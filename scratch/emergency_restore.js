const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

const startStr = "const logs = await window.TurnosDB.fetchLogs(20);";
const endStr = "const shortId = escapeHtml(String(log.id || '').slice(0, 8));";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const sectionToReplace = content.substring(startIndex, endIndex);
    const restoration = `const logs = await window.TurnosDB.fetchLogs(20);

                // Calcular actividad hoy
                const todayISO = new Date().toISOString().split('T')[0];
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
                    timeline.innerHTML = logs.map(log => {
                        const title = log.revertida ? 'Publicacion Revertida' : 'Sincronizacion Cloud';
                        const total = Number(log.cambios_totales || 0);
                        const user = escapeHtml(log.usuario || 'Admin');
                        `;
    
    content = content.replace(sectionToReplace, restoration);
    
    // Also fix the aplicarCambioLocal which failed to replace correctly
    const aplicarStart = "window.aplicarCambioLocal = (payload) => {";
    const aplicarEnd = "window.updateSidebarBadges = async () => {";
    const aSIdx = content.indexOf(aplicarStart);
    const aEIdx = content.indexOf(aplicarEnd);
    
    if (aSIdx !== -1 && aEIdx !== -1) {
        const aplicarRestoration = `window.aplicarCambioLocal = (payload) => {
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

`;
        content = content.substring(0, aSIdx) + aplicarRestoration + content.substring(aEIdx);
    }

    fs.writeFileSync(path, content, 'utf8');
    console.log('Restored dashboard logic and fixed aplicarCambioLocal.');
} else {
    console.log('Indices not found for restoration.');
}
