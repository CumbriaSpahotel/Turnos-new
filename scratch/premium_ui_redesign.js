
const fs = require('fs');

const htmlPath = 'admin.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. ADD PREMIUM CSS FOR NAVIGATION
const navStyles = `
    /* ESTILOS PREMIUM NAVEGACIÓN */
    .nav-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--bg2);
        padding: 12px 24px;
        border-bottom: 1px solid var(--border);
        box-shadow: 0 2px 10px rgba(0,0,0,0.02);
        margin-bottom: 20px;
        position: sticky;
        top: 0;
        z-index: 100;
    }
    .nav-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--bg2);
        color: var(--text);
        cursor: pointer;
        transition: all 0.2s ease-in-out;
    }
    .nav-btn:hover {
        background: var(--bg3);
        border-color: var(--accent);
        color: var(--accent);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.05);
    }
    .nav-btn-text {
        padding: 0 16px;
        height: 36px;
        border-radius: 18px;
        font-size: 0.8rem;
        font-weight: 600;
        border: 1px solid var(--border);
        background: var(--bg2);
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .nav-btn-text:hover {
        background: var(--bg3);
        border-color: var(--text-muted);
    }
    .nav-date-indicator {
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--text);
        letter-spacing: -0.02em;
        transition: opacity 0.2s ease;
    }
    .nav-toggle-group {
        display: flex;
        background: var(--bg3);
        padding: 4px;
        border-radius: 12px;
        border: 1px solid var(--border);
    }
    .nav-toggle-btn {
        padding: 6px 16px;
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: 700;
        border: none;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .nav-toggle-btn.active {
        background: var(--text);
        color: white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .nav-calendar-trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: var(--bg3);
        color: var(--text-muted);
        border: 1px solid var(--border);
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .nav-calendar-trigger:hover {
        color: var(--accent);
        border-color: var(--accent);
        background: white;
    }
`;

// Insert styles in head
if (!html.includes('/* ESTILOS PREMIUM NAVEGACIÓN */')) {
    html = html.replace('</head>', `<style>${navStyles}</style>\n</head>`);
}

// 2. REDESIGN section-preview structure
const sectionPreviewContent = `
        <section id="section-preview" class="section">
            <header class="page-header" style="border-bottom:none; margin-bottom:0; padding-bottom:15px;">
                <div>
                    <h1 class="page-title">Vista Previa Operativa</h1>
                    <p class="page-subtitle">Cuadrante maestro de turnos y coberturas</p>
                </div>
                <div style="margin-left:auto;">
                    <select id="prevHotel" class="btn-premium" onchange="window.renderPreview()" style="min-width:220px; font-weight:700; background:var(--surface2); border:1px solid var(--border);"></select>
                </div>
            </header>

            <nav class="nav-toolbar">
                <div class="nav-group">
                    <button class="nav-btn" onclick="window.NavigationManager.prev()" title="Anterior">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button class="nav-btn-text" onclick="window.NavigationManager.today()">Hoy</button>
                    <button class="nav-btn" onclick="window.NavigationManager.next()" title="Siguiente">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>

                <div class="nav-date-indicator" id="dateDisplay">Cargando...</div>

                <div class="nav-group">
                    <div class="nav-toggle-group">
                        <button id="btnViewWeekly" class="nav-toggle-btn active" onclick="window.NavigationManager.switchView('weekly')">Semanal</button>
                        <button id="btnViewMonthly" class="nav-toggle-btn" onclick="window.NavigationManager.switchView('monthly')">Mensual</button>
                    </div>
                    <div style="width:1px; height:24px; background:var(--border); margin:0 5px;"></div>
                    <button class="nav-calendar-trigger" id="datePickerTrigger" onclick="window.NavigationManager.openPicker()" title="Elegir fecha">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <input type="text" id="datePicker" style="position:absolute; visibility:hidden; width:0; height:0;">
                    </button>
                </div>
            </nav>

            <div id="previewContent" style="padding:0 30px 30px;"></div>
        </section>
`;

const previewRegex = /<section id="section-preview" class="section">[\s\S]*?<\/section>/;
html = html.replace(previewRegex, sectionPreviewContent);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log("admin.html updated: Premium navigation UI and styles implemented.");
