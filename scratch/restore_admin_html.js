const fs = require('fs');
const htmlPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// Definir las secciones a inyectar
const missingSections = `
        <!-- GESTIÓN EXCEL -->
        <section id="section-excel" class="section">
            <header class="page-header">
                <div>
                    <h1 class="page-title">Modo Excel (Base de Datos)</h1>
                    <p class="page-subtitle">Visualización directa de public.turnos en Supabase</p>
                </div>
            </header>
            <div id="excel-grid-container" style="padding:0 30px 30px;"></div>
        </section>

        <!-- CONFIGURACIÓN -->
        <section id="section-config" class="section">
            <header class="page-header"><div><h1 class="page-title">Configuración del Sistema</h1></div></header>
            <div id="config-content" style="padding:0 30px 30px;">
                <div class="glass-panel" style="padding:24px; border-radius:24px; border:1px solid var(--border); background:var(--surface);">
                    <h3 style="margin-top:0; font-size:1rem; font-weight:800; color:var(--text); margin-bottom:18px;">Parámetros Globales</h3>
                    <div style="display:grid; gap:20px; max-width:600px;">
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">Nombre de la Empresa</label>
                            <input type="text" class="btn-premium" style="width:100%;" value="Cumbria & Guadiana">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">Modo de Visualización</label>
                            <select class="btn-premium" style="width:100%;">
                                <option>Llamativo (Premium)</option>
                                <option>Compacto (Excel)</option>
                            </select>
                        </div>
                        <div style="padding-top:10px;">
                            <button class="btn-publish-premium" onclick="alert('Configuración guardada (Simulado)')">Guardar Configuración</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>`;

const empDrawerHtml = `
    <!-- DRAWER DE EMPLEADO (MÓVIL / LATERAL) -->
    <div id="empDrawer" class="drawer-overlay" onclick="window.closeEmpDrawer()">
        <div class="drawer-content" onclick="event.stopPropagation()">
            <div class="drawer-header">
                <h3 id="drawerTitle">Detalle Empleado</h3>
                <button class="btn-close-drawer" onclick="window.closeEmpDrawer()">&times;</button>
            </div>
            <div id="drawerBody" class="drawer-body"></div>
        </div>
    </div>`;

// 1. Restaurar </main> y las secciones (si se borró </main>)
if (html.includes('</section>') && !html.includes('</main>')) {
    html = html.replace(/<\/section>\s+<!-- MODALES -->/, `</section>\n${missingSections}\n\n    <!-- MODALES -->`);
} else if (html.includes('</main>')) {
    // Si todavía existe </main>, insertar antes
    html = html.replace('</main>', missingSections);
}

// 2. Insertar empDrawer antes de los SCRIPTS si no existe
if (!html.includes('id="empDrawer"')) {
    html = html.replace('<!-- SCRIPTS -->', empDrawerHtml + '\n\n    <!-- SCRIPTS -->');
}

fs.writeFileSync(htmlPath, html);
console.log("admin.html sections and drawer restored via script.");
