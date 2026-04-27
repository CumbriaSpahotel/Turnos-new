const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const calendarFunc = `
window.renderEmployeeProfileCalendar = (model) => {
    const days = model.calendario || [];
    const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    
    return \`
        <div class="emp-calendar-shell">
            <div class="emp-calendar-week-head">
                \${weekdays.map(w => \`<span>\${w}</span>\`).join('')}
            </div>
            <div class="emp-calendar-grid month">
                \${days.map(day => {
                    const label = window.employeeShiftLabel(day).replace('&mdash;', '-').replace('PENDIENTE DE ASIGNAR', '-').replace('Descanso', 'D');
                    const labelShort = label.length > 2 ? label.charAt(0) : label;
                    const isToday = day.fecha === window.isoDate(new Date());
                    
                    let statusClass = '';
                    if (day.incidencia) {
                        const type = window.normalizeTipo(day.incidencia.tipo);
                        if (type === 'VAC') statusClass = 'vac';
                        else if (type === 'BAJA' || type === 'IT') statusClass = 'baja';
                        else statusClass = 'event';
                    } else if (label === 'D' || label === 'Descanso') {
                        statusClass = 'descanso';
                    } else if (['M','T','N'].includes(labelShort.toUpperCase())) {
                        statusClass = labelShort.toLowerCase();
                    }

                    const cls = [
                        'emp-cal-cell',
                        day.outsideMonth ? 'outside' : '',
                        isToday ? 'today' : '',
                        statusClass ? 'st-' + statusClass : '',
                        day.cambio ? 'has-change' : '',
                        day.sustitucion ? 'is-sust' : ''
                    ].filter(Boolean).join(' ');
                    
                    return \`
                        <div class="\${cls}" onclick="window.openEmployeeDayDetail('\${day.fecha}')" title="\${day.fecha}: \${label}">
                            <span class="day-num">\${day.fecha.split('-')[2]}</span>
                            <span class="shift-tag">\${labelShort}</span>
                        </div>
                    \`;
                }).join('')}
            </div>
            <div class="emp-calendar-legend" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; font-size: 0.65rem;">
                <div style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#10b981;"></span> Mañana</div>
                <div style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#f59e0b;"></span> Tarde</div>
                <div style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#3b82f6;"></span> Noche</div>
                <div style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#94a3b8;"></span> Descanso</div>
                <div style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#ef4444;"></span> Baja/IT</div>
                <div style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#2563eb;"></span> Vacaciones</div>
            </div>
        </div>
    \`;
};`;

const marker = 'window.renderEmployeeProfile =';
if (content.includes(marker) && !content.includes('window.renderEmployeeProfileCalendar =')) {
    content = content.replace(marker, calendarFunc + '\n\n' + marker);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Restored window.renderEmployeeProfileCalendar');
} else {
    console.log('Function already present or marker not found');
}
