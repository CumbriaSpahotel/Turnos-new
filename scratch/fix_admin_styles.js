const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const target = `D:    { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: 'Descanso', icon: '' }`;
const replacement = `D:    { bg: '#fee2e2', color: '#991b1b', border: '#fecaca', label: 'Descanso', icon: '' }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed Descanso style in admin.js');
} else {
    console.log('Target for Descanso style not found or already fixed');
}
