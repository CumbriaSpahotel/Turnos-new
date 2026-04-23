const fs = require('fs');
const code = fs.readFileSync('./turnos-engine.js', 'utf8');
const rulesCode = fs.readFileSync('./turnos-rules.js', 'utf8');

global.window = {};
eval(rulesCode);
eval(code);

const rows = [ 
  { empleado_id: 'miriam', tipo: 'CT', sustituto: 'cristina', fecha: '2026-04-20', turno: 'T' }, 
  { empleado_id: 'cristina', tipo: 'CT', sustituto: 'miriam', fecha: '2026-04-20', turno: 'CT' } 
]; 
const sourceRows = [ 
  { empleadoId: 'Cristina', displayName: 'Cristina', values: ['T'] }, 
  { empleadoId: 'Miriam', displayName: 'Miriam', values: ['M'] } 
]; 

const res = window.TurnosEngine.buildDayRoster({ 
  rows, 
  date: '2026-04-20', 
  hotel: 'Cumbria', 
  sourceRows 
}); 

console.log(JSON.stringify(res, null, 2));
