
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. ADD Global State for Navigation
const globalState = `
window._previewMode = 'weekly';
window._previewDate = window.isoDate(new Date()); // Fecha de referencia global
window._fpWeek = null;
window._fpMonth = null;
`;

// Insert after utilidades globales
content = content.replace('// --- UTILIDADES GLOBALES ---', '// --- UTILIDADES GLOBALES ---' + globalState);

// 2. RE-IMPLEMENT Navigation Functions
const navLogic = `
window.navigateToday = () => {
    window._previewDate = window.isoDate(new Date());
    if (window._previewMode === 'weekly' && window._fpWeek) {
        window._fpWeek.setDate(window._previewDate);
    } else if (window._previewMode === 'monthly' && window._fpMonth) {
        window._fpMonth.setDate(window._previewDate);
    }
    window.renderPreview();
};

window.navigatePreview = (dir) => {
    const current = new Date(window._previewDate + 'T12:00:00');
    if (window._previewMode === 'weekly') {
        current.setDate(current.getDate() + (dir * 7));
    } else {
        current.setMonth(current.getMonth() + dir);
    }
    window._previewDate = window.isoDate(current);
    
    // Sincronizar Pickers
    if (window._previewMode === 'weekly' && window._fpWeek) window._fpWeek.setDate(window._previewDate);
    if (window._previewMode === 'monthly' && window._fpMonth) window._fpMonth.setDate(window._previewDate);
    
    window.renderPreview();
};

window.switchPreviewMode = (mode) => {
    window._previewMode = mode;
    
    // UI Toggle
    const btnW = document.getElementById('btnViewWeekly');
    const btnM = document.getElementById('btnViewMonthly');
    const inputW = document.getElementById('prevWeekDate');
    const inputM = document.getElementById('prevMonth');
    
    if (mode === 'weekly') {
        btnW?.classList.add('active');
        btnM?.classList.remove('active');
        if (inputW) inputW.style.display = 'block';
        if (inputM) inputM.style.display = 'none';
    } else {
        btnM?.classList.add('active');
        btnW?.classList.remove('active');
        if (inputW) inputW.style.display = 'none';
        if (inputM) inputM.style.display = 'block';
    }
    
    window.initPreviewPickers();
    window.renderPreview();
};

window.initPreviewPickers = () => {
    const wInput = document.getElementById('prevWeekDate');
    const mInput = document.getElementById('prevMonth');
    
    if (wInput && !window._fpWeek) {
        window._fpWeek = flatpickr(wInput, {
            locale: 'es',
            defaultDate: window._previewDate,
            onChange: (selectedDates) => {
                if (selectedDates.length) {
                    window._previewDate = window.isoDate(selectedDates[0]);
                    window.renderPreview();
                }
            }
        });
    }
    
    if (mInput && !window._fpMonth) {
        window._fpMonth = flatpickr(mInput, {
            locale: 'es',
            plugins: [new monthSelectPlugin({ shorthand: true, dateFormat: "Y-m", altFormat: "F Y" })],
            defaultDate: window._previewDate,
            onChange: (selectedDates) => {
                if (selectedDates.length) {
                    window._previewDate = window.isoDate(selectedDates[0]);
                    window.renderPreview();
                }
            }
        });
    }
};
`;

// Insert before renderPreview
content = content.replace('window.renderPreview = async () =>', navLogic + '\nwindow.renderPreview = async () =>');

// 3. UPDATE renderPreview to use window._previewDate
content = content.replace(/const rawDate = .*$/m, "    const rawDate = window._previewDate;");
content = content.replace(/const rawMonth = .*$/m, "    const rawMonth = window._previewDate.substring(0,7);");

// 4. REMOVE old navigatePreview
const oldNavStart = 'window.navigatePreview = (dir) => {';
const oldNavIdx = content.indexOf(oldNavStart);
if (oldNavIdx !== -1) {
    const endIdx = content.indexOf('};', oldNavIdx) + 2;
    content = content.substring(0, oldNavIdx) + content.substring(endIdx);
}

// 5. UPDATE DOMContentLoaded to init pickers
content = content.replace('setTimeout(window.renderDashboard, 1000);', 'setTimeout(window.renderDashboard, 1000);\n    window.initPreviewPickers();');

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Temporal navigation logic implemented.");
