const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const missingFunctions = `
window.openEmpDrawer = (idOrName) => {
    window._employeeProfileId = idOrName;
    window._employeeProfileDate = window.isoDate(new Date());
    window._employeeProfileMode = 'month';
    window._employeeProfileTab = 'overview';
    window._employeeProfileEditing = false;
    window.renderEmployeeProfile();
};

window.enableEmployeeProfileEdit = () => {
    window._employeeProfileEditing = true;
    window.renderEmployeeProfile();
};

window.cancelEmployeeProfileEdit = () => {
    window._employeeProfileEditing = false;
    window.renderEmployeeProfile();
};

window.saveEmployeeProfileInline = async () => {
    const model = window.buildEmployeeProfileModel(window._employeeProfileId, window._employeeProfileDate);
    if (!model) return;
    const line = (window._employeeLineModels || []).find(item => window.employeeNorm(item.id) === window.employeeNorm(model.empleado.id) || window.employeeNorm(item.nombre) === window.employeeNorm(model.empleado.nombre));
    const payload = { ...(line?.profile || {}), id: model.empleado.id };
    document.querySelectorAll('[data-emp-field]').forEach(input => {
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
    }
    if (!payload.nombre) payload.nombre = model.empleado.nombre;
    try {
        await window.TurnosDB.upsertEmpleado(payload);
        window._employeeProfileEditing = false;
        if (window.populateEmployees) await window.populateEmployees();
        window.renderEmployeeProfile();
    } catch (err) {
        console.error('[EMPLEADO ERROR]', err);
        alert('Error al guardar: ' + err.message);
    }
};`;

const marker = 'window.openEmployeeDayDetail =';
if (content.includes(marker) && !content.includes('window.openEmpDrawer =')) {
    content = content.replace(marker, missingFunctions + '\n\n' + marker);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Restored missing employee profile functions (take 3)');
} else {
    console.log('Functions already present or marker not found');
}
