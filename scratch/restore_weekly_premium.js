
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. RESTORE Premium Capsule Style for Weekly View in renderEmpleadoCell
const cellStart = 'window.renderEmpleadoCell = (turnoEmpleado, { isCompact = false } = {}) => {';
const newCell = `window.renderEmpleadoCell = (turnoEmpleado, { isCompact = false } = {}) => {
    if (!turnoEmpleado) return '<div class="preview-cell-empty"></div>';

    const turnoVisible = turnoEmpleado.incidencia || turnoEmpleado.turno || '';
    const turnoBase = turnoEmpleado.turno_base || '';
    const hayCambio = Boolean(turnoEmpleado.cambio || (turnoVisible && turnoBase && turnoVisible !== turnoBase && !['VAC','BAJA','PERM'].includes(turnoVisible)));

    // Capsule definitions (Shifts & Incidences)
    const capsuleStyles = {
        VAC:  { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc', label: 'Vacaciones', icon: '🏖️' },
        BAJA: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', label: 'Baja', icon: '🏥' },
        PERM: { bg: '#ffedd5', color: '#9a3412', border: '#fdba74', label: 'Permiso', icon: '📄' },
        M:    { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Mañana', icon: '' },
        T:    { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: 'Tarde', icon: '' },
        N:    { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: 'Noche', icon: '🌙' },
        D:    { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: 'Descanso', icon: '' }
    };

    const shiftKey = window.TurnosRules?.shiftKey?.(turnoVisible, 'NORMAL') || String(turnoVisible).toUpperCase();
    const styleKey = ['VAC','BAJA','PERM'].includes(turnoVisible) ? turnoVisible : shiftKey;
    const style = capsuleStyles[styleKey] || { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: turnoVisible || '—', icon: '' };

    if (isCompact) {
        // VISTA MENSUAL: Estilo plano y minimalista
        const compactBg = style.bg;
        const compactColor = style.color;
        const labelText = turnoVisible || '—';
        const compactIcons = (turnoVisible === 'VAC' ? '🏖️' : '') + (hayCambio ? ' 🔄' : '');
        
        return \`
        <div style="display:flex; align-items:center; justify-content:center; padding:4px 2px; border-radius:6px; font-size:0.7rem; font-weight:700; min-height:45px; background:\${compactBg}; color:\${compactColor}; border:1px solid rgba(0,0,0,0.05);">
            \${escapeHtml(labelText)}\${compactIcons ? \` <span style="font-size:0.65rem;">\${compactIcons}</span>\` : ''}
        </div>\`;
    } else {
        // VISTA SEMANAL: Estilo PREMIUM (Capsule)
        const label = capsuleStyles[styleKey]?.label || turnoVisible || '—';
        let iconHtml = '';
        if (style.icon) iconHtml += \` <span style="margin-left:4px;">\${style.icon}</span>\`;
        if (hayCambio && !['VAC','BAJA','PERM'].includes(turnoVisible)) iconHtml += \` <span style="margin-left:4px;">🔄</span>\`;

        return \`
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:75px; gap:4px;">
            <span style="display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; border-radius:999px; font-size:0.8rem; font-weight:800; background:\${style.bg}; color:\${style.color}; border:1px solid \${style.border}; box-shadow:0 1px 3px rgba(0,0,0,0.06); white-space:nowrap;">
                \${escapeHtml(label)}\${iconHtml}
            </span>
        </div>\`;
    }
};`;

const cellStartIdx = content.indexOf(cellStart);
if (cellStartIdx !== -1) {
    const endIdx = content.indexOf('};', cellStartIdx) + 2;
    content = content.substring(0, cellStartIdx) + newCell + content.substring(endIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Restored Premium Capsule style for Weekly View.");
