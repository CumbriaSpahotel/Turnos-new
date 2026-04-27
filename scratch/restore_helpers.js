const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const helperBlock = `
window.employeeProfileBadges = (model) => {
    const emp = model.empleado;
    const typeNorm = window.employeeNorm(emp.tipo);
    const status = window.employeeStatusMeta(emp.estado);
    const badges = [{ label: status.label, cls: status.cls }];
    if (model.eventosActivos.some(ev => /VAC/i.test(ev.tipo || ''))) badges.push({ label: 'Vacaciones', cls: 'vacaciones' });
    if (model.eventosActivos.some(ev => /BAJA|PERM/i.test(ev.tipo || ''))) badges.push({ label: 'Baja', cls: 'baja' });
    if (typeNorm.includes('sust') || model.calendario.some(d => d.sustitucion)) badges.push({ label: 'Sustituto', cls: 'sustituto' });
    if (typeNorm.includes('ocas')) badges.push({ label: 'Ocasional', cls: 'ocasional' });
    if (typeNorm.includes('apoyo')) badges.push({ label: 'Apoyo', cls: 'apoyo' });
    return badges.filter((b, idx, arr) => arr.findIndex(x => x.label === b.label) === idx);
};

window.employeeFieldSizeClass = (key, type) => {
    if (type === 'textarea') return 'span-12';
    if (key === 'id') return 'span-4';
    if (key === 'nombre') return 'span-8';
    if (key === 'hotel_id') return 'span-12';
    if (key === 'puesto') return 'span-6';
    if (['categoria', 'tipo_personal', 'contrato', 'estado_empresa', 'id_interno'].includes(key)) return 'span-6';
    if (['fecha_alta', 'fecha_baja'].includes(key)) return 'span-6';
    if (['telefono', 'email'].includes(key)) return 'span-6';
    return 'span-6';
};

window.renderEmployeeProfileField = ([label, value, key, type = 'text']) => {
    const editing = Boolean(window._employeeProfileEditing);
    const rawValue = value === null || typeof value === 'undefined' ? '' : String(value);
    const sizeClass = window.employeeFieldSizeClass(key, type);
    const iconMap = {
        id: 'id', nombre: 'person', hotel_id: 'hotel', puesto: 'briefcase', categoria: 'laboral',
        tipo_personal: 'profile', contrato: 'laboral', estado_empresa: 'status', fecha_alta: 'calendar',
        fecha_baja: 'calendar', telefono: 'phone', email: 'mail', activo: 'toggle', id_interno: 'id'
    };
    const iconKey = iconMap[key];
    const iconHtml = iconKey ? \`<span class="field-icon">\${window.employeeIcon(iconKey)}</span>\` : '';

    if (!editing || !key) {
        return \`
            <div class="emp-profile-field \${sizeClass}">
                <dt>\${iconHtml} \${escapeHtml(label)}</dt>
                <dd>\${window.employeeFormatNumber(value)}</dd>
            </div>
        \`;
    }
    const common = \`data-emp-field="\${escapeHtml(key)}" data-emp-type="\${escapeHtml(type)}"\`;
    let inputHtml = '';
    
    if (key === 'hotel_id') {
        const hotels = window._employeeLineHotels || ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
        inputHtml = \`
            <select \${common}>
                <option value="">Seleccionar hotel...</option>
                \${hotels.map(h => \`<option value="\${escapeHtml(h)}" \${h === rawValue ? 'selected' : ''}>\${escapeHtml(h)}</option>\`).join('')}
            </select>
        \`;
    } else if (key === 'tipo_personal') {
        const types = ['fijo', 'apoyo', 'ocasional', 'sustituto'];
        inputHtml = \`
            <select \${common}>
                \${types.map(t => \`<option value="\${escapeHtml(t)}" \${t === rawValue ? 'selected' : ''}>\${escapeHtml(t.charAt(0).toUpperCase() + t.slice(1))}</option>\`).join('')}
            </select>
        \`;
    } else if (key === 'estado_empresa') {
        const states = ['ACTIVO', 'BAJA'];
        inputHtml = \`
            <select \${common}>
                \${states.map(s => \`<option value="\${escapeHtml(s)}" \${s === rawValue.toUpperCase() ? 'selected' : ''}>\${escapeHtml(s)}</option>\`).join('')}
            </select>
        \`;
    } else if (type === 'boolean') {
        const normalized = window.employeeNorm(rawValue);
        inputHtml = \`
            <select \${common}>
                <option value="true" \${normalized === 'si' || normalized === 'true' ? 'selected' : ''}>Si</option>
                <option value="false" \${normalized === 'no' || normalized === 'false' ? 'selected' : ''}>No</option>
            </select>
        \`;
    } else if (type === 'textarea') {
        inputHtml = \`<textarea \${common} rows="2">\${escapeHtml(rawValue)}</textarea>\`;
    } else {
        inputHtml = \`<input \${common} type="\${type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}" value="\${escapeHtml(rawValue)}">\`;
    }
    return \`
        <label class="emp-profile-field editable \${sizeClass}">
            <span>\${iconHtml} \${escapeHtml(label)}</span>
            \${inputHtml}
        </label>
    \`;
};`;

const marker = 'window.renderEmployeeProfile =';
if (content.includes(marker) && !content.includes('window.renderEmployeeProfileField =')) {
    content = content.replace(marker, helperBlock + '\n\n' + marker);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Restored helper functions');
} else {
    console.log('Helpers already present or marker not found');
}
