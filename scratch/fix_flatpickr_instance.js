
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UNIFY Flatpickr Instance Management
const pickerLogic = `
window._fpInstance = null;

window.initPreviewPickers = () => {
    const input = document.getElementById('datePicker');
    if (!input) return;

    // Destruir instancia previa para evitar conflictos en el mismo elemento
    if (window._fpInstance && typeof window._fpInstance.destroy === 'function') {
        window._fpInstance.destroy();
    }

    const config = {
        locale: 'es',
        defaultDate: window._previewDate,
        onChange: (selectedDates) => {
            if (selectedDates.length) {
                window._previewDate = window.isoDate(selectedDates[0]);
                window.renderPreview();
            }
        }
    };

    if (window._previewMode === 'monthly') {
        config.plugins = [new monthSelectPlugin({ shorthand: true, dateFormat: "Y-m", altFormat: "F Y" })];
    }

    window._fpInstance = flatpickr(input, config);
};
`;

const oldPickerStart = 'window.initPreviewPickers = () => {';
const oldPickerIdx = content.indexOf(oldPickerStart);
if (oldPickerIdx !== -1) {
    const endIdx = content.indexOf('};', content.indexOf('window._fpMonth = flatpickr(', oldPickerIdx)) + 2;
    content = content.substring(0, oldPickerIdx) + pickerLogic + content.substring(endIdx);
}

// 2. UPDATE Navigation Functions to use window._fpInstance
content = content.replace(/window._fpWeek && window._fpWeek.setDate/g, "window._fpInstance && window._fpInstance.setDate");
content = content.replace(/window._fpMonth && window._fpMonth.setDate/g, "window._fpInstance && window._fpInstance.setDate");
content = content.replace(/window._fpWeek.setDate/g, "window._fpInstance.setDate");
content = content.replace(/window._fpMonth.setDate/g, "window._fpInstance.setDate");

// 3. CLEAN UP switchPreviewMode
const oldSwitchStart = 'window.switchPreviewMode = (mode) => {';
const newSwitch = `window.switchPreviewMode = (mode) => {
    window._previewMode = mode;
    
    // UI Toggle
    const btnW = document.getElementById('btnViewWeekly');
    const btnM = document.getElementById('btnViewMonthly');
    if (btnW) btnW.classList.toggle('active', mode === 'weekly');
    if (btnM) btnM.classList.toggle('active', mode === 'monthly');
    
    window.initPreviewPickers();
    window.renderPreview();
};`;

const switchIdx = content.indexOf(oldSwitchStart);
if (switchIdx !== -1) {
    const endSwitchIdx = content.indexOf('};', switchIdx) + 2;
    content = content.substring(0, switchIdx) + newSwitch + content.substring(endSwitchIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Flatpickr instance management unified and fixed.");
