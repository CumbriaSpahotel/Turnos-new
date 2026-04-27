
const fs = require('fs');

const filePath = 'admin.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE section-preview header in admin.html
const oldHeaderControls = `                <div class="header-controls" style="display:flex; gap:10px; margin-left:auto; align-items:center;">
                    <select id="prevHotel" class="btn-premium" onchange="renderPreview()"></select>
                    <div id="prevDateContainer" style="display:flex; align-items:center; gap:6px;">
                        <button class="btn-premium" onclick="navigatePreview(-1)">←</button>
                        <input type="text" id="prevWeekDate" class="btn-premium" style="width:130px; text-align:center;">
                        <button class="btn-premium" onclick="navigatePreview(1)">→</button>
                    </div>
                    <div class="btn-group" style="display:flex; gap:5px;">
                        <button class="btn-premium active" id="btnViewWeekly" onclick="switchPreviewMode('weekly')">Semanal</button>
                        <button class="btn-premium" id="btnViewMonthly" onclick="switchPreviewMode('monthly')">Mensual</button>
                    </div>
                </div>`;

const newHeaderControls = `                <div class="header-controls" style="display:flex; gap:12px; margin-left:auto; align-items:center;">
                    <!-- Selector de Hotel -->
                    <select id="prevHotel" class="btn-premium" onchange="window.renderPreview()" style="background:var(--surface);"></select>

                    <!-- Navegación Temporal -->
                    <div id="prevNavControls" style="display:flex; align-items:center; gap:4px; background:var(--bg3); padding:4px; border-radius:12px; border:1px solid var(--border);">
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
                    </div>

                    <!-- Toggle Vista -->
                    <div class="btn-group-premium" style="display:flex; gap:2px; background:var(--bg3); padding:4px; border-radius:12px; border:1px solid var(--border);">
                        <button class="btn-premium active" id="btnViewWeekly" onclick="window.switchPreviewMode('weekly')">Semanal</button>
                        <button class="btn-premium" id="btnViewMonthly" onclick="window.switchPreviewMode('monthly')">Mensual</button>
                    </div>
                </div>`;

content = content.replace(oldHeaderControls, newHeaderControls);

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.html updated: Temporal navigation UI added.");
