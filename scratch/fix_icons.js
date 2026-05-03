const fs = require('fs');
const path = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

const targetRegex = /const badge = \(list, cls, defaultIcon\) => \{[\s\S]+?cells\.push\(`[\s\S]+?D','d','[\s\S]+?'\)\);/;
const match = content.match(targetRegex);

if (match) {
    const replacement = `const badge = (list, cls, defaultIcon) => {
                        if (!list.length) return '';
                        const names = list.map(item => \`<span title="\${escapeHtml(item.title || '')}">\${escapeHtml(item.name)}\${item.icon === '📌' ? '📌' : ''}</span>\`).join(' · ');
                        return \`<div class="cal2-group cal2-\${cls}"><span class="cal2-icon">\${defaultIcon}</span><span class="cal2-names">\${names}</span></div>\`;
                    };

                    cells.push(\`<div class="cal2-cell">
                        <div class="cal2-daynum">\${new Date(dateKey + 'T12:00:00').getDate()}</div>
                        <div class="cal2-content">
                            \${badge(groups.M,'m','☀️')}
                            \${badge(groups.T,'t','🌅')}
                            \${badge(groups.N,'n','🌙')}
                            \${badge(groups.D,'d','⚪')}\`);`;
    
    content = content.replace(match[0], replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed icon block in admin.js');
} else {
    console.log('Could not find the icon block in admin.js');
}
