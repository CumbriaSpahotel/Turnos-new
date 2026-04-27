
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. DEFINE NavigationManager
const navManager = `
window.NavigationManager = {
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
        
        // El label se actualiza en renderPreview, pero aseguramos sincronización de modo
        window._previewMode = this.state.view;
        window._previewDate = this.state.currentDate;
    },

    prev: function() {
        const d = new Date(this.state.currentDate + 'T12:00:00');
        if (this.state.view === 'weekly') d.setDate(d.getDate() - 7);
        else d.setMonth(d.getMonth() - 1, 1);
        this.state.currentDate = window.isoDate(d);
        this.syncAndRender();
    },

    next: function() {
        const d = new Date(this.state.currentDate + 'T12:00:00');
        if (this.state.view === 'weekly') d.setDate(d.getDate() + 7);
        else d.setMonth(d.getMonth() + 1, 1);
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
};
`;

// 2. REMOVE old functions and insert NavigationManager
// We'll replace from navigateToday until before renderPreview
const startToken = 'window.navigateToday = () => {';
const endToken = 'window.renderPreview = async () => {';
const startIdx = content.indexOf(startToken);
const endIdx = content.indexOf(endToken);

if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + navManager + '\\n\\n' + content.substring(endIdx);
}

// 3. Update DOMContentLoaded to call NavigationManager.init()
content = content.replace('window.initPreviewPickers();', 'window.NavigationManager.init();');

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: NavigationManager implemented.");
