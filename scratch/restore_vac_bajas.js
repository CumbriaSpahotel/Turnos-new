const fs = require('fs');
const path = require('path');

const adminJsPath = path.resolve(__dirname, '../admin.js');
let content = fs.readFileSync(adminJsPath, 'utf8');

const vacationAndBajasFunctions = `
// ==========================================
// MÓDULO: VACACIONES Y BAJAS (RESTAURADO)
// ==========================================
window.renderVacations = async () => {
    const area = $('#vacations-content');
    if (!area) return;
    area.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando vacaciones...</div>';
    try {
        const start = \`\${new Date().getFullYear()}-01-01\`;
        const end = \`\${new Date().getFullYear()}-12-31\`;
        const eventos = await window.TurnosDB.fetchEventos(start, end);
        const vacs = eventos.filter(ev => String(ev.tipo || '').startsWith('VAC') && ev.estado !== 'anulado');
        
        if (vacs.length === 0) {
            area.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;">No hay vacaciones registradas este año.</div>';
            return;
        }

        vacs.sort((a,b) => a.fecha_inicio.localeCompare(b.fecha_inicio));

        area.innerHTML = \`
            <div class="glass-panel" style="padding:0; overflow:hidden; border-radius:15px; border:1px solid var(--border);">
                <table class="preview-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:var(--bg3);">
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Empleado</th>
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Hotel</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Desde</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Hasta</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${vacs.map(v => \`
                            <tr style="border-top:1px solid var(--border);">
                                <td style="padding:1rem; font-weight:700; color:var(--accent);">\${v.empleado_id}</td>
                                <td style="padding:1rem; font-size:0.85rem;">\${v.hotel_origen || 'General'}</td>
                                <td style="padding:1rem; text-align:center;">\${window.fmtDateLegacy ? window.fmtDateLegacy(v.fecha_inicio) : v.fecha_inicio}</td>
                                <td style="padding:1rem; text-align:center;">\${window.fmtDateLegacy ? window.fmtDateLegacy(v.fecha_fin) : v.fecha_fin}</td>
                                <td style="padding:1rem; text-align:center;"><span style="background:rgba(16,185,129,0.1); color:#10b981; padding:4px 10px; border-radius:8px; font-weight:800; font-size:0.6rem;">ACTIVO</span></td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            </div>
        \`;
    } catch (e) { area.innerHTML = '<div style="color:red;">Error: ' + e.message + '</div>'; }
};

window.renderBajas = async () => {
    const area = $('#absences-content');
    if (!area) return;
    area.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando ausencias...</div>';
    try {
        const data = await window.TurnosDB.fetchBajasPermisos({ estadoFiltro: 'all' });
        if (data.length === 0) {
            area.innerHTML = '<div style="padding:4rem; text-align:center; opacity:0.5;">No hay bajas o permisos registrados.</div>';
            return;
        }
        data.sort((a,b) => b.fecha_inicio.localeCompare(a.fecha_inicio));

        area.innerHTML = \`
            <div class="glass-panel" style="padding:0; overflow:hidden; border-radius:15px; border:1px solid var(--border);">
                <table class="preview-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:var(--bg3);">
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Tipo</th>
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Empleado</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Periodo</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${data.map(b => \`
                            <tr style="border-top:1px solid var(--border);">
                                <td style="padding:1rem;"><span style="background:rgba(239,68,68,0.1); color:#ef4444; padding:4px 10px; border-radius:8px; font-weight:800; font-size:0.6rem;">\${b.tipo}</span></td>
                                <td style="padding:1rem; font-weight:700;">\${b.empleado_id}</td>
                                <td style="padding:1rem; text-align:center;">\${window.fmtDateLegacy(b.fecha_inicio)} — \${window.fmtDateLegacy(b.fecha_fin || b.fecha_inicio)}</td>
                                <td style="padding:1rem; text-align:center;"><span style="background:rgba(16,185,129,0.1); color:#10b981; padding:4px 10px; border-radius:8px; font-weight:800; font-size:0.6rem;">ACTIVO</span></td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            </div>
        \`;
    } catch (e) { area.innerHTML = '<div style="color:red;">Error: ' + e.message + '</div>'; }
};
`;

// Insertamos después de handleRequestAction (aprox línea 320 en la versión actual)
const insertionPoint = content.indexOf('// =========================================='); // Buscamos el primer bloque de módulos

if (insertionPoint !== -1) {
    const newContent = content.slice(0, insertionPoint) + vacationAndBajasFunctions + content.slice(insertionPoint);
    fs.writeFileSync(adminJsPath, newContent, 'utf8');
    console.log('Módulos de Vacaciones y Bajas restaurados.');
} else {
    // Si no encuentra el bloque, al final
    fs.appendFileSync(adminJsPath, vacationAndBajasFunctions, 'utf8');
    console.log('Módulos de Vacaciones y Bajas añadidos al final.');
}
