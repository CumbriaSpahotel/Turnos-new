const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const goToRiskPreviewFn = `
window.goToRiskPreview = (hotel, weekStart) => {
    console.log('[NAV_DASHBOARD_PREVIEW]', { hotel, weekStart });
    // 1. Cambiar a la sección de Vista Previa
    if (window.switchSection) window.switchSection('preview');
    
    // 2. Esperar a que el DOM se actualice
    setTimeout(() => {
        const hotelSelect = document.getElementById('previewHotel');
        const dateInput = document.getElementById('previewDate');
        
        if (hotelSelect) {
            hotelSelect.value = hotel;
            hotelSelect.dispatchEvent(new Event('change'));
        }
        
        if (dateInput) {
            dateInput.value = weekStart;
            if (dateInput._flatpickr) {
                dateInput._flatpickr.setDate(weekStart, true);
            }
        }
        
        // 3. Forzar el renderizado de la vista previa
        if (window.renderPreview) {
            window.renderPreview();
        }
    }, 150);
};
`;

if (!content.includes('window.goToRiskPreview =')) {
    content += goToRiskPreviewFn;
    fs.writeFileSync(path, content, 'utf8');
    console.log('Added goToRiskPreview to admin.js');
} else {
    console.log('goToRiskPreview function already exists');
}
