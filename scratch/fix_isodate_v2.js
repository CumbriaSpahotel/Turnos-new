
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// The file likely has literal \\n now or something weird.
// Let's just fix the top of the file properly.

const utilities = `
window.formatDisplayName = (name) => {
    if (!name) return '';
    return name.replace(/_DUP_.*$/, '').replace(/_CT$/, '').replace(/_/g, ' ').trim();
};
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => document.querySelectorAll(s);
window.safeGet = (id) => document.getElementById(id) || { textContent: '', style: {}, innerHTML: '', value: '' };
window.isoDate = (date) => {
    if (!date) return null;
    const d = (typeof date === 'string') ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return \`\${y}-\${m}-\${day}\`;
};
window.fmtDateLegacy = (dateStr) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return \`\${parts[2]}/\${parts[1]}/\${parts[0].slice(2)}\`;
};

window._previewMode = 'weekly';
window._previewDate = window.isoDate(new Date()); 
window._fpWeek = null;
window._fpMonth = null;
`;

// Replace everything from the start until getWeekStartISO (which is the next function)
const nextFunc = 'window.getWeekStartISO =';
const nextIdx = content.indexOf(nextFunc);

if (nextIdx !== -1) {
    content = utilities + '\n' + content.substring(nextIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js utilities and state cleaned up and re-ordered.");
