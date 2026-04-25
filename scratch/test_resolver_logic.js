const fs = require('fs');
const path = require('path');

global.window = global;
const rulesCode = fs.readFileSync('turnos-rules.js', 'utf8');
eval(rulesCode);
const resolverCode = fs.readFileSync('shift-resolver.js', 'utf8');
eval(resolverCode);

const eventos = [
    {
        tipo: 'VAC',
        estado: 'activo',
        empleado_id: 'cristina',
        hotel_origen: 'Cumbria Spa&Hotel',
        fecha_inicio: '2026-04-20',
        fecha_fin: '2026-04-26'
    }
];

const res = window.resolveEmployeeDay({
    empleadoId: 'cristina',
    hotel: 'Cumbria Spa&Hotel',
    fecha: '2026-04-20',
    turnoBase: 'M',
    eventos: eventos
});
res._finalState = res; // Simular lo que hace admin.js

console.log('Result for Cristina: [Object]');
console.log('Result for Cristina: [Object]');
const v = window.TurnosRules.describeCell(res);
console.log('Visual Label:', v.label);
console.log('Visual Icon:', v.icon);
console.log('Visual Class:', v.publicClass);
