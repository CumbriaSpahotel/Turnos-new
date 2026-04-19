const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const syncHtml = `
                <div id="syncStatus" class="status-badge-premium" style="margin-left:auto; display:flex; align-items:center; gap:8px; padding:6px 12px; border-radius:30px; font-size:0.75rem; font-weight:600; background:var(--bg3); border:1px solid var(--border);">
                    <span id="syncDot" style="width:8px; height:8px; border-radius:50%; background:#ff9800;"></span>
                    <span id="syncText" style="color:var(--text-dim);">Conectando...</span>
                </div>`;

files.forEach(f => {
    // Skip if it's not a dashboard module
    if (!['admin.html', 'bajas.html', 'cambios.html', 'solicitudes.html', 'bandeja.html', 'configuracion.html', 'vacaciones.html'].includes(f)) return;
    
    const fullPath = path.join(dir, f);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // Remove old syncStatus if it exists to cleanly replace
    content = content.replace(/<div id="syncStatus"[\s\S]*?<\/div>/, '');

    // Inject before </header> inside page-header
    if (content.includes('</header>')) {
        content = content.replace(/<\/header>/, syncHtml + '\n            </header>');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Injected HTML to', f);
    }
});
