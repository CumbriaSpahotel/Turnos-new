
const fs = require('fs');

const htmlPath = 'admin.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. UPDATE HTML with exact requested IDs and dateDisplay label
const oldNavControls = `<div id="prevNavControls" style="display:flex; align-items:center; gap:4px; background:var(--bg3); padding:4px; border-radius:12px; border:1px solid var(--border);">
                        <button class="btn-icon-premium" onclick="window.navigatePreview(-1)" title="Anterior">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        <button class="btn-premium" onclick="window.navigateToday()" style="font-size:0.75rem; padding:4px 12px; height:32px;">Hoy</button>
                        <button class="btn-icon-premium" onclick="window.navigatePreview(1)" title="Siguiente">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                    </div>

                    <!-- Selector de Fecha/Mes -->
                    <div id="prevDateInputGroup" style="position:relative; display:flex; align-items:center;">
                        <input type="text" id="prevWeekDate" class="btn-premium" style="width:140px; text-align:center; cursor:pointer;" readonly>
                        <input type="text" id="prevMonth" class="btn-premium" style="width:140px; text-align:center; cursor:pointer; display:none;" readonly>
                    </div>`;

const newNavControls = `<div id="dynamicNavControls" style="display:flex; align-items:center; gap:15px; background:var(--bg3); padding:6px 15px; border-radius:14px; border:1px solid var(--border);">
                        <div style="display:flex; gap:5px;">
                            <button id="prevBtn" class="btn-icon-premium" onclick="window.navigatePreview(-1)" title="Anterior">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <button id="todayBtn" class="btn-premium" onclick="window.navigateToday()" style="font-size:0.75rem; padding:4px 12px; height:32px; font-weight:700;">Hoy</button>
                            <button id="nextBtn" class="btn-icon-premium" onclick="window.navigatePreview(1)" title="Siguiente">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                        
                        <div id="dateDisplay" style="font-weight:800; color:var(--text); font-size:0.9rem; min-width:180px; text-align:center; letter-spacing:-0.01em;">Cargando...</div>

                        <div style="position:relative; display:flex; align-items:center;">
                            <input type="text" id="datePicker" class="btn-premium" style="width:40px; text-align:center; cursor:pointer; padding:0; background:transparent; border:none; color:var(--text-dim);" value="📅" readonly>
                        </div>
                    </div>`;

html = html.replace(oldNavControls, newNavControls);
fs.writeFileSync(htmlPath, html, 'utf8');

// 2. UPDATE JS Logic
const jsPath = 'admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

// Update initPreviewPickers to use #datePicker
js = js.replace(/document.getElementById\('prevWeekDate'\)/g, "document.getElementById('datePicker')");
js = js.replace(/document.getElementById\('prevMonth'\)/g, "document.getElementById('datePicker')");
// Monthly mode needs to ensure we handle the switch
js = js.replace('plugins: [new monthSelectPlugin', 'noCalendar: false, plugins: [new monthSelectPlugin');

// Update renderPreview to refresh the dateDisplay label
const renderStart = 'window.renderPreview = async () => {';
const labelUpdate = `
    const display = document.getElementById('dateDisplay');
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
`;
js = js.replace(renderStart, renderStart + labelUpdate);

const weeklyLabel = `
            if (display) display.textContent = \`\${window.fmtDateLegacy(window.isoDate(start))} - \${window.fmtDateLegacy(window.isoDate(end))}\`;
`;
const monthlyLabel = `
            if (display) display.textContent = \`\${monthNames[start.getMonth()]} \${start.getFullYear()}\`;
`;

js = js.replace('start = window.getMonday(base);', 'start = window.getMonday(base);' + weeklyLabel);
js = js.replace('start = new Date(y, m - 1, 1);', 'start = new Date(y, m - 1, 1);' + monthlyLabel);

fs.writeFileSync(jsPath, js, 'utf8');
console.log("admin.html and admin.js updated: Dynamic temporal navigation with labels implemented.");
