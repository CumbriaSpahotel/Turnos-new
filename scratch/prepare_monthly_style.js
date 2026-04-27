
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. ADD formatDisplayName helper
const formatDisplayNameHelper = `
window.formatDisplayName = (name) => {
    if (!name) return '';
    // Eliminar sufijos técnicos como _DUP_..., _CT, etc.
    // El regex /_DUP_.*$/ elimina todo desde _DUP_ hasta el final.
    // También limpiamos guiones bajos por espacios si sobran.
    return name.replace(/_DUP_.*$/, '').replace(/_CT$/, '').replace(/_/g, ' ').trim();
};
`;

if (!content.includes('window.formatDisplayName =')) {
    // Insert after common helpers
    const anchor = 'window.normalizeId =';
    const index = content.indexOf(anchor);
    if (index !== -1) {
        content = content.substring(0, index) + formatDisplayNameHelper + content.substring(index);
    } else {
        content = formatDisplayNameHelper + content;
    }
}

// 2. UPDATE renderEmpleadoRowHeader to use formatDisplayName
const rowHeaderStart = 'window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {';
const rowHeaderIndex = content.indexOf(rowHeaderStart);
if (rowHeaderIndex !== -1) {
    const endIdx = content.indexOf('};', rowHeaderIndex) + 2;
    const currentHeader = content.substring(rowHeaderIndex, endIdx);
    
    // Replace name rendering logic inside the function
    const updatedHeader = currentHeader.replace(
        /const name = escapeHtml\(employee\?\.nombre \|\| employee\?\.displayName \|\| 'Empleado'\);/,
        `const rawName = employee?.nombre || employee?.displayName || 'Empleado';
    const name = escapeHtml(window.formatDisplayName(rawName));`
    );
    
    content = content.substring(0, rowHeaderIndex) + updatedHeader + content.substring(endIdx);
}

// 3. UPDATE renderPreview to handle Monthly Style
const renderPreviewStart = 'window.renderPreview = async (startISO, endISO, filterHotel = null) => {';
const renderPreviewIndex = content.indexOf(renderPreviewStart);
if (renderPreviewIndex !== -1) {
    // Find where isWeekly is defined
    const isWeeklyIdx = content.indexOf('const isWeekly =', renderPreviewIndex);
    // ...
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Name cleaning and Monthly View preparation.");
