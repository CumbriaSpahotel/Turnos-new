const fs = require('fs');
const path = require('path');

global.window = {
    addEventListener: () => {},
    TurnosDB: { getEmpleados: async () => [] }
};
global.document = {
    getElementById: ()=>({ textContent:'', style:{}, innerHTML:'', value:'' }),
    querySelector: ()=>({ textContent:'', style:{}, innerHTML:'', value:'' }),
    querySelectorAll: ()=>[],
    addEventListener: ()=>{}
};
global.$ = () => ({ innerHTML: '', classList: { remove:()=>{} }, addEventListener: ()=>{} });

const adminPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
require(adminPath);

console.log('employeeStatusMeta("Baja empresa"):', window.employeeStatusMeta("Baja empresa"));
console.log('employeeStatusMeta("Baja laboral"):', window.employeeStatusMeta("Baja laboral"));
console.log('employeeStatusMeta("Baja"):', window.employeeStatusMeta("Baja"));
console.log('employeeStatusMeta("Activo"):', window.employeeStatusMeta("Activo"));
