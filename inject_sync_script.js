const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(f => {
    // Skip if it's not a dashboard module
    if (!['admin.html', 'bajas.html', 'cambios.html', 'solicitudes.html', 'bandeja.html', 'configuracion.html', 'vacaciones.html'].includes(f)) return;
    
    const fullPath = path.join(dir, f);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // Inject before </body>
    if (content.includes('</body>') && !content.includes('<script src="sync-status.js"></script>')) {
        content = content.replace(/<\/body>/, '    <script src="sync-status.js"></script>\n</body>');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Injected global sync JS to', f);
    }
});
