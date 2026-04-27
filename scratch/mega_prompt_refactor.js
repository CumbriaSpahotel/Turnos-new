
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. RENAME NavigationManager to DateManager and refine logic
const oldNavManagerStart = 'window.NavigationManager = {';
const newDateManager = `window.DateManager = {
    state: {
        currentDate: window.isoDate(new Date()),
        view: 'weekly'
    },

    init: function() {
        this.state.currentDate = window._previewDate || window.isoDate(new Date());
        this.state.view = window._previewMode || 'weekly';
        this.initPicker();
        this.updateUI();
    },

    updateUI: function() {
        const btnW = document.getElementById('btnViewWeekly');
        const btnM = document.getElementById('btnViewMonthly');
        if (btnW) btnW.classList.toggle('active', this.state.view === 'weekly');
        if (btnM) btnM.classList.toggle('active', this.state.view === 'monthly');
        
        window._previewMode = this.state.view;
        window._previewDate = this.state.currentDate;
    },

    prev: function() {
        const d = new Date(this.state.currentDate + 'T12:00:00');
        if (this.state.view === 'weekly') {
            d.setDate(d.getDate() - 7);
        } else {
            d.setMonth(d.getMonth() - 1, 1); // Ir al día 1 del mes anterior
        }
        this.state.currentDate = window.isoDate(d);
        this.syncAndRender();
    },

    next: function() {
        const d = new Date(this.state.currentDate + 'T12:00:00');
        if (this.state.view === 'weekly') {
            d.setDate(d.getDate() + 7);
        } else {
            d.setMonth(d.getMonth() + 1, 1); // Ir al día 1 del mes siguiente
        }
        this.state.currentDate = window.isoDate(d);
        this.syncAndRender();
    },

    today: function() {
        this.state.currentDate = window.isoDate(new Date());
        this.syncAndRender();
    },

    switchView: function(mode) {
        this.state.view = mode;
        this.updateUI();
        this.initPicker();
        window.renderPreview();
    },

    syncAndRender: function() {
        this.updateUI();
        if (window._fpInstance) window._fpInstance.setDate(this.state.currentDate, false);
        window.renderPreview();
    },

    initPicker: function() {
        const input = document.getElementById('datePicker');
        if (!input) return;
        if (window._fpInstance) window._fpInstance.destroy();

        const config = {
            locale: 'es',
            defaultDate: this.state.currentDate,
            onChange: (selectedDates) => {
                if (selectedDates.length) {
                    this.state.currentDate = window.isoDate(selectedDates[0]);
                    this.syncAndRender();
                }
            }
        };

        if (this.state.view === 'monthly') {
            config.plugins = [new monthSelectPlugin({ shorthand: true, dateFormat: "Y-m", altFormat: "F Y" })];
        }

        window._fpInstance = flatpickr(input, config);
    },

    openPicker: function() {
        if (window._fpInstance) window._fpInstance.open();
    }
};`;

const startIdx = content.indexOf(oldNavManagerStart);
if (startIdx !== -1) {
    const endIdx = content.indexOf('};', content.indexOf('openPicker: function() {', startIdx)) + 2;
    content = content.substring(0, startIdx) + newDateManager + content.substring(endIdx);
}

// 2. UPDATE DOMContentLoaded to call DateManager.init()
content = content.replace('window.NavigationManager.init();', 'window.DateManager.init();');

// 3. ADD Weekend Shading in Monthly View
const weekendShadingTh = `\${columns.map(c => {
                                        const isWeekend = c.dayName === 'SAB' || c.dayName === 'DOM';
                                        const bg = (!isWeekly && isWeekend) ? '#f1f5f9' : '#f8fafc';
                                        return \`<th style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:\${minColWidth}; border-left:1px solid #f1f5f9; background:\${bg};"><div style="font-size:0.65rem; color:#94a3b8;">\${c.dayName}</div><div style="font-size:0.75rem; font-weight:600;">\${c.dayDisplay.toLowerCase()}</div></th>\`;
                                    }).join('')}`;

const oldThRow = `\${columns.map(c => \`<th style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:\${minColWidth}; border-left:1px solid #f1f5f9;"><div style="font-size:0.65rem; color:#94a3b8;">\${c.dayName}</div><div style="font-size:0.75rem; font-weight:600;">\${c.dayDisplay.toLowerCase()}</div></th>\`).join('')}`;
content = content.replace(oldThRow, weekendShadingTh);

const weekendShadingTd = `\${columns.map(c => {
                                            const isWeekend = c.dayName === 'SAB' || c.dayName === 'DOM';
                                            const bg = (!isWeekly && isWeekend) ? 'rgba(0,0,0,0.03)' : 'transparent';
                                            return \`<td style="padding:\${cellPadding}; text-align:center; border-left:1px solid #f1f5f9; background:\${bg};">\${window.renderEmpleadoCell(previewModel.getTurnoEmpleado(employee.employee_id, c.date), { isCompact: !isWeekly })}</td>\`;
                                        }).join('')}`;

const oldTdRow = `\${columns.map(c => \`<td style="padding:\${cellPadding}; text-align:center; border-left:1px solid #f1f5f9;">\${window.renderEmpleadoCell(previewModel.getTurnoEmpleado(employee.employee_id, c.date), { isCompact: !isWeekly })}</td>\`).join('')}`;
content = content.replace(oldTdRow, weekendShadingTd);

// 4. Update admin.html to call window.DateManager
const htmlPath = 'admin.html';
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/window\.NavigationManager/g, 'window.DateManager');
fs.writeFileSync(htmlPath, html, 'utf8');

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js and admin.html updated: DateManager implemented and Weekend Shading added.");
