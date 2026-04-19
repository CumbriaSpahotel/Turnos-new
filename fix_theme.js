const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.css'));

files.forEach(f => {
    const fullPath = path.join(dir, f);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // Body class change
    if (content.includes('<body class="light-mode">')) {
        content = content.replace(/<body class="light-mode">/g, '<body class="light-mode">');
        changed = true;
    }

    // fallback theme
    if (content.includes("localStorage.getItem('turnosweb_theme') || 'light'")) {
        content = content.replace(/localStorage\.getItem\('turnosweb_theme'\) \|\| 'dark'/g, "localStorage.getItem('turnosweb_theme') || 'light'");
        changed = true;
    }

    // flatpickr dark theme link removal from HTML
    if (content.includes('')) {
        content = content.replace(/<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/npm\/flatpickr\/dist\/themes\/dark\.css">\r?\n?/g, '');
        changed = true;
    }

    // Make default date range 'today' to 'endOfYear'
    if (content.includes('')) {
        content = content.replace(/const startOfYear = new Date\(today\.getFullYear\(\), 0, 1\);\r?\n?/g, '');
        content = content.replace(/defaultDate: \[startOfYear, endOfYear\]/g, 'defaultDate: [today, endOfYear]');
        changed = true;
    }

    // Timezone issue in ISOString fix
    if (content.includes("toISOString().split('T')[0]")) {
        content = content.replace(/const s = selectedDates\[0\]\.toISOString\(\)\.split\('T'\)\[0\];/g, "const d1 = selectedDates[0]; const s = `${d1.getFullYear()}-${String(d1.getMonth()+1).padStart(2,'0')}-${String(d1.getDate()).padStart(2,'0')}`;");
        content = content.replace(/const e = selectedDates\[1\]\.toISOString\(\)\.split\('T'\)\[0\];/g, "const d2 = selectedDates[1]; const e = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`;");
        changed = true;
    }

    // flatpickr CSS fix for light mode
    if (content.includes('color: white !important;') && f.endsWith('.html')) {
        content = content.replace(/color: white !important;/g, 'color: var(--text) !important;');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated', f);
    }
});
