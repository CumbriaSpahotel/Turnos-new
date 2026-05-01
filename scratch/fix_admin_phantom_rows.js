const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add check for empId in reinforcement loop
const targetRef = `            const empId = ev.empleado_id;
            const normEmpId = window.normalizeId(empId);`;
const replacementRef = `            const empId = ev.empleado_id;
            if (!empId) return;
            const normEmpId = window.normalizeId(empId);`;

if (content.includes(targetRef)) {
    content = content.replace(targetRef, replacementRef);
}

// 2. Final filter for valid employees in getEmployees
const targetReturn = `        return [...operationalRows, ...absentRows, ...extraRefuerzoRows];`;
const replacementReturn = `        return [...operationalRows, ...absentRows, ...extraRefuerzoRows].filter(r => r.employee_id && r.nombre && r.nombre !== 'Empleado');`;

if (content.includes(targetReturn)) {
    content = content.replace(targetReturn, replacementReturn);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.js reinforcement check and final row filter applied');
