
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// Refine switchPreviewMode to handle datePicker reconfiguration
const switchModeStart = 'window.switchPreviewMode = (mode) => {';
const newSwitchMode = `window.switchPreviewMode = (mode) => {
    window._previewMode = mode;
    
    // UI Toggle
    const btnW = document.getElementById('btnViewWeekly');
    const btnM = document.getElementById('btnViewMonthly');
    
    if (mode === 'weekly') {
        btnW?.classList.add('active');
        btnM?.classList.remove('active');
    } else {
        btnM?.classList.add('active');
        btnW?.classList.remove('active');
    }
    
    // Reset Pickers so they can be re-initialized for the correct mode
    if (window._fpWeek) { window._fpWeek.destroy(); window._fpWeek = null; }
    if (window._fpMonth) { window._fpMonth.destroy(); window._fpMonth = null; }
    
    window.initPreviewPickers();
    window.renderPreview();
};`;

const startIdx = content.indexOf(switchModeStart);
if (startIdx !== -1) {
    const endIdx = content.indexOf('};', startIdx) + 2;
    content = content.substring(0, startIdx) + newSwitchMode + content.substring(endIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: switchPreviewMode refined for datePicker reconfiguration.");
