const fs = require('fs');

const htmlPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.html';
let html = fs.readFileSync(htmlPath, 'utf8');

const dashboardTarget = `<div class="dashboard-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:20px; padding:0 30px 30px;">`;
const dashboardEnd = `</section>`;

const newDashboardContent = `<div class="dashboard-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:20px; padding:0 30px 30px;">
                <div class="kpi-card glass" style="padding:20px; border-radius:20px; border:1px solid var(--border); background:var(--surface);">
                    <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Cambios Pendientes</label>
                    <strong id="stat-pending-requests" style="font-size:1.5rem; font-weight:900; color:var(--text);">0</strong>
                </div>
                <div class="kpi-card glass" style="padding:20px; border-radius:20px; border:1px solid var(--border); background:var(--surface);">
                    <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Bajas Activas</label>
                    <strong id="stat-today-activity" style="font-size:1.5rem; font-weight:900; color:var(--text);">0</strong>
                </div>
                <div class="kpi-card glass" style="padding:20px; border-radius:20px; border:1px solid var(--border); background:var(--surface);">
                    <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Cloud Status</label>
                    <strong id="stat-cloud-status" style="font-size:1.5rem; font-weight:900; color:#10b981;">-</strong>
                </div>
                <div class="kpi-card glass" style="padding:20px; border-radius:20px; border:1px solid var(--border); background:var(--surface);">
                    <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Última Sincro</label>
                    <strong id="stat-last-sync" style="font-size:1.2rem; font-weight:800; color:var(--text);">00:00:00</strong>
                </div>
                <div class="kpi-card glass" style="padding:20px; border-radius:20px; border:1px solid var(--border); background:var(--surface);">
                    <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Pendientes Pub.</label>
                    <strong id="stat-pending-diff" style="font-size:1.5rem; font-weight:900; color:var(--text);">0</strong>
                </div>
                <div class="kpi-card glass" style="padding:20px; border-radius:20px; border:1px solid var(--border); background:var(--surface);">
                    <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:10px;">Integridad Datos</label>
                    <strong id="stat-integrity-score" style="font-size:1.5rem; font-weight:900; color:var(--text);">0%</strong>
                </div>
            </div>

            <div class="full-width-panel" style="padding:0 30px 20px;">
                <div id="operational-risk" class="operational-risk-panel" style="background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:20px;">
                    <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h3 style="margin:0; font-size:1rem; font-weight:800;"><i class="fas fa-shield-alt" style="margin-right:10px; color:#ef4444;"></i> RIESGO OPERATIVO PRIORITARIO</h3>
                        <div class="severity-badge-container" style="display:flex; gap:10px;">
                            <div class="severity-badge critical" id="count-critical" style="background:#fee2e2; color:#b91c1c; padding:4px 12px; border-radius:20px; font-weight:700; font-size:0.75rem;">0 Críticos</div>
                            <div class="severity-badge warning" id="count-warning" style="background:#fff7ed; color:#c2410c; padding:4px 12px; border-radius:20px; font-weight:700; font-size:0.75rem;">0 Avisos</div>
                            <div class="severity-badge info" id="count-info" style="background:#f0f9ff; color:#0369a1; padding:4px 12px; border-radius:20px; font-weight:700; font-size:0.75rem;">0 Info</div>
                        </div>
                    </div>
                    <div id="risk-alerts-container" class="risk-alerts-full"></div>
                </div>
            </div>

            <div class="dashboard-secondary-grid" style="display:grid; grid-template-columns: 1.2fr 1fr; gap:20px; padding:0 30px 30px;">
                <!-- ACCIONES RÁPIDAS -->
                <div class="glass-panel" style="padding:20px; border-radius:20px; border:1px solid var(--border); background:var(--surface);">
                    <h3 style="margin:0 0 20px; font-size:1rem; font-weight:800; color:var(--text); text-transform:uppercase;"><i class="fas fa-bolt" style="margin-right:10px; color:#f59e0b;"></i> Acciones Rápidas</h3>
                    <div id="dashboard-quick-actions"></div>
                </div>

                <!-- ACTIVIDAD RECIENTE -->
                <div class="glass-panel" style="padding:20px; border-radius:20px; border:1px solid var(--border); background:var(--surface);">
                    <h3 style="margin:0 0 20px; font-size:1rem; font-weight:800; color:var(--text); text-transform:uppercase;"><i class="fas fa-history" style="margin-right:10px; color:#6366f1;"></i> Actividad de Operaciones</h3>
                    <div id="dashboard-timeline" style="max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>`;

// Encontrar el final de la sección home
const homeStart = html.indexOf('<section id="section-home"');
const homeEnd = html.indexOf('</section>', homeStart) + 10;
const homeSection = html.slice(homeStart, homeEnd);

const updatedHomeSection = `<section id="section-home" class="section active">
            <header class="page-header">
                <div>
                    <h1 class="page-title">Sistemas de Control Operativo</h1>
                    <p class="page-subtitle">Estado global y monitoreo de riesgos en tiempo real</p>
                </div>
            
                <div id="syncStatus" class="status-badge-premium" style="margin-left:auto; display:flex; align-items:center; gap:8px; padding:6px 12px; border-radius:30px; font-size:0.75rem; font-weight:600; background:var(--bg3); border:1px solid var(--border);">
                    <span id="syncDot" style="width:8px; height:8px; border-radius:50%; background:#ff9800;"></span>
                    <span id="syncText" style="color:var(--text-dim);">Conectando...</span>
                </div>
            </header>

            ${newDashboardContent}
        </section>`;

html = html.replace(homeSection, updatedHomeSection);
fs.writeFileSync(htmlPath, html);
console.log("admin.html dashboard restored and enhanced.");
