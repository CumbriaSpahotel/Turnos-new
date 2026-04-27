
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE Date Display Format and fix the 'end' variable bug
const oldWeeklyLogic = 'if (isWeekly) {\\n            const base = new Date(rawDate + \\'T12:00:00\\');\\n            start = window.getMonday(base);\\n            if (display) display.textContent = `${window.fmtDateLegacy(window.isoDate(start))} - ${window.fmtDateLegacy(window.isoDate(end))}`;\\n\\n            end = new Date(start);\\n            end.setDate(start.getDate() + 6);';

const newWeeklyLogic = `        if (isWeekly) {
            const base = new Date(rawDate + 'T12:00:00');
            start = window.getMonday(base);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            
            if (display) {
                const fmt = (d) => {
                    const days = d.getDate().toString().padStart(2, '0');
                    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][d.getMonth()];
                    return \`\${days} de \${months}\`;
                };
                display.textContent = \`\${fmt(start)} - \${fmt(end)} \${end.getFullYear()}\`;
            }
`;
// Note: fmtDateLegacy was dd/mm/yy. User wants "DD de [Mes] - DD de [Mes] [Año]"

// We need to match the actual code in the file which might have been modified by previous runs.
// Let's use a more robust search.

const renderStartMarker = 'if (isWeekly) {';
const startIdx = content.indexOf(renderStartMarker, content.indexOf('window.renderPreview = async () => {'));
if (startIdx !== -1) {
    const endIdx = content.indexOf('} else {', startIdx);
    content = content.substring(0, startIdx) + newWeeklyLogic + content.substring(endIdx);
}

// 2. UPDATE Weekend Shading Alpha to 0.02
content = content.replace(/rgba\(0,0,0,0\.03\)/g, 'rgba(0,0,0,0.02)');

// 3. REFINE result filter for Anti-Ghost rule
content = content.replace('return clean !== "";', 'return clean && clean.length > 0;');

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Premium Dashboard logic and cleanup refined.");
