const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const targetLoop = `            employeesToRender.forEach(emp => {
                const key = emp.employee_id;
                if (!seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });`;

const replacementLoop = `            employeesToRender.forEach(emp => {
                const key = emp.employee_id || emp.id || '';
                const name = emp.nombreVisible || emp.displayName || emp.nombre || '';
                if (key && name && !seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });`;

if (content.includes(targetLoop)) {
    content = content.replace(targetLoop, replacementLoop);
}

// Ensure Unicode emojis in definitions (just in case they were lost)
// Note: I already updated turnos-rules.js, so that should be the source of truth if we use window.TurnosRules.describeCell
// But admin.js has its own capsuleStyles at 3654.
const targetCapsule = `    const capsuleStyles = {
        V:    { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc', label: 'Vacaciones', icon: '🏖️' },
        B:    { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', label: 'Baja', icon: '' },
        P:    { bg: '#ffedd5', color: '#9a3412', border: '#fdba74', label: 'Permiso', icon: '' },
        M:    { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Mañana', icon: '' },
        T:    { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: 'Tarde', icon: '' },
        N:    { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: 'Noche', icon: '🌙' },
        D:    { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: 'Descanso', icon: '' }
    };`;

const replacementCapsule = `    const capsuleStyles = {
        V:    { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc', label: 'Vacaciones', icon: '\\u{1F3D6}\\u{FE0F}' },
        B:    { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', label: 'Baja', icon: '' },
        P:    { bg: '#ffedd5', color: '#9a3412', border: '#fdba74', label: 'Permiso', icon: '' },
        M:    { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Mañana', icon: '' },
        T:    { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: 'Tarde', icon: '' },
        N:    { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: 'Noche', icon: '\\u{1F319}' },
        D:    { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: 'Descanso', icon: '' }
    };`;

if (content.includes(targetCapsule)) {
    content = content.replace(targetCapsule, replacementCapsule);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.js deduplication loop and capsule styles fixed');
