const fs = require('fs');
const path = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');
let lines = content.split('\n');

// Find the line with "const badge =" around 4475
let startIndex = -1;
for (let i = 4470; i < 4500; i++) {
    if (lines[i] && lines[i].includes('const badge =')) {
        startIndex = i;
        break;
    }
}

if (startIndex !== -1) {
    const replacementLines = [
        "                    const badge = (list, cls, defaultIcon) => {",
        "                        if (!list.length) return '';",
        "                        const names = list.map(item => `<span title=\"${escapeHtml(item.title || '')}\">${escapeHtml(item.name)}${item.icon === '📌' ? '📌' : ''}</span>`).join(' · ');",
        "                        return `<div class=\"cal2-group cal2-${cls}\"><span class=\"cal2-names\">${names}</span></div>`;",
        "                    };",
        "",
        "                    cells.push(`<div class=\"cal2-cell\">",
        "                        <div class=\"cal2-daynum\">${new Date(dateKey + 'T12:00:00').getDate()}</div>",
        "                        <div class=\"cal2-content\">",
        "                            ${badge(groups.M,'m','')}",
        "                            ${badge(groups.T,'t','')}",
        "                            ${badge(groups.N,'n','🌙')}",
        "                            ${badge(groups.D,'d','')}",
        "                            ${groups.ABS.map(a => `<div class=\"cal2-group cal2-${a.cls}\" title=\"${escapeHtml(a.title || '')}\"><span class=\"cal2-icon\">${a.icon === 'V' ? '🏖️' : (a.icon === 'B' ? '🤒' : (a.icon === 'P' ? '🗓️' : a.icon))}</span><span class=\"cal2-names\">${a.name}</span></div>`).join('')}",
        "                        </div>",
        "                    </div>`);"
    ];
    
    // We replace 16 lines starting from startIndex
    lines.splice(startIndex, 16, ...replacementLines);
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Sanitized icon block in admin.js');
} else {
    console.log('Could not find the start of badge block.');
}
