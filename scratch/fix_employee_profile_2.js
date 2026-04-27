const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Sync activo/estado_empresa in saveEmployeeProfileInline
const oldSaveLoop = `    document.querySelectorAll('[data-emp-field]').forEach(input => {
        const key = input.dataset.empField;
        const type = input.dataset.empType || input.type;
        let value = input.value;
        if (type === 'boolean') value = value === 'true';
        if (type === 'number') value = value === '' ? null : Number(value);
        if (type === 'date' && value === '') value = null;
        payload[key] = value;
    });`;

const newSaveLoop = `    document.querySelectorAll('[data-emp-field]').forEach(input => {
        const key = input.dataset.empField;
        const type = input.dataset.empType || input.type;
        let value = input.value;
        if (type === 'boolean') value = value === 'true';
        if (type === 'number') value = value === '' ? null : Number(value);
        if (type === 'date' && value === '') value = null;
        payload[key] = value;
    });
    // Sync Activo/Estado
    if (payload.estado_empresa === 'BAJA') {
        payload.activo = false;
    } else if (payload.estado_empresa === 'ACTIVO') {
        payload.activo = true;
    }`;

if (content.includes(oldSaveLoop)) {
    content = content.replace(oldSaveLoop, newSaveLoop);
}

// 2. Add Provisional Balance Text
const oldVacRow = "<strong>${window.employeeFormatNumber(model.vacaciones.saldo)}</strong>";
const newVacRow = "<strong>${window.employeeFormatNumber(model.vacaciones.saldo)}</strong><div style='font-size:0.5rem; color:#94a3b8; font-weight:normal; margin-top:2px;'>Saldo provisional (eventos VAC)</div>";

if (content.includes(oldVacRow)) {
    content = content.replace(oldVacRow, newVacRow);
}

// 3. Improve Overwork Alert with Debug
const oldAlertBox = "alerts.push(`<div class=\"emp-alert-box\" style=\"background:#fff1f2; border-color:#fecdd3; color:#9f1239;\"><i class=\"fas fa-running\"></i><span><strong>EXCESO DE JORNADA:</strong> Detectados ${maxConsecutive} días seguidos trabajando sin descanso.</span></div>`);";
const newAlertBox = "alerts.push(`<div class=\"emp-alert-box\" style=\"background:#fff1f2; border-color:#fecdd3; color:#9f1239;\"><i class=\"fas fa-running\"></i><span><strong>EXCESO DE JORNADA:</strong> Detectados ${maxConsecutive} días seguidos trabajando sin descanso.</span></div>`);\n                    if (window.DEBUG_MODE === true) {\n                        console.log(`[JORNADA DEBUG] Empleado: ${model.empleado.nombre}, Racha Máxima: ${maxConsecutive}`);\n                    }";

if (content.includes(oldAlertBox)) {
    content = content.replace(oldAlertBox, newAlertBox);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully applied second set of fixes to admin.js');
