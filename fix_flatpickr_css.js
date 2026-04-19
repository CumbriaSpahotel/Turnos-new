const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const cssToInject = `
    <style>
        .nav-item.active { background: var(--accent-dim); color: var(--accent); border-right: 3px solid var(--accent); }
        /* Personalización Flatpickr Premium */
        .flatpickr-calendar { background: var(--bg2) !important; border: 1px solid var(--border) !important; box-shadow: var(--shadow-lg) !important; border-radius: 14px !important; padding: 10px !important; }
        .flatpickr-months { margin-bottom: 10px; }
        .flatpickr-months .flatpickr-month { background: transparent !important; color: var(--text) !important; fill: var(--text) !important; }
        .flatpickr-months .flatpickr-prev-month, .flatpickr-months .flatpickr-next-month { fill: var(--text) !important; color: var(--text) !important; }
        .flatpickr-months .flatpickr-prev-month:hover, .flatpickr-months .flatpickr-next-month:hover { background: var(--surface) !important; border-radius: 8px; }
        .flatpickr-weekdays { background: transparent !important; }
        span.flatpickr-weekday { color: var(--text-muted) !important; font-weight: 700; }
        .flatpickr-day { color: var(--text) !important; border-radius: 8px !important; transition: all 0.2s; font-weight: 500; }
        .flatpickr-day:hover { background: var(--surface) !important; color: var(--accent) !important; }
        .flatpickr-day.selected, .flatpickr-day.startRange, .flatpickr-day.endRange { background: var(--accent) !important; border-color: var(--accent) !important; color: white !important; font-weight: bold; }
        .flatpickr-day.inRange { background: var(--accent-dim) !important; border-color: transparent !important; box-shadow: none !important; color: var(--text) !important; border-radius: 0 !important; }
        .flatpickr-day.startRange.endRange { border-radius: 8px !important; }
        .flatpickr-day.startRange { border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important; }
        .flatpickr-day.endRange { border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important; }
        .flatpickr-day.today { border-color: var(--accent-dim) !important; background: rgba(79,134,247,0.05); }
    </style>
`;

files.forEach(f => {
    const fullPath = path.join(dir, f);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Regex to match existing <style> block related to flatpickr
    // It captures <style> ...  </style> where it has .nav-item.active ...
    const regex = /<style>\s*\.nav-item\.active[\s\S]*?<\/style>/;
    
    if (content.match(regex)) {
        content = content.replace(regex, cssToInject.trim());
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated flatpickr CSS in', f);
    }
});
