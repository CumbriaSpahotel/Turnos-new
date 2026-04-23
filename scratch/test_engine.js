const fs = require('fs');

const window = { _debugTurnos: false, TurnosDB: {} };
global.window = window;

eval(fs.readFileSync('./turnos-rules.js', 'utf8'));

const normalizeString = (s) => String(s||'').toLowerCase();
global.normalizeString = normalizeString;
const profileMap = () => new Map();
global.profileMap = profileMap;
const profileFor = () => null;
global.profileFor = profileFor;
const employeeComputesForStats = () => true;
global.employeeComputesForStats = employeeComputesForStats;
const canonicalize = (name) => normalizeString(name);
global.canonicalize = canonicalize;

eval(fs.readFileSync('./turnos-engine.js', 'utf8'));

console.log('--- TEST A: CRISTINA -> MIRIAM ---');
{
    const date = '2026-04-20';
    const hotel = 'Cumbria';
    const sourceRows = [
        { empleadoId: 'Cristina', displayName: 'Cristina', rowIndex: 0, values: ['Vacaciones 🏖'] }
    ];
    // Supongamos que en DAO la fila original de cristina se extrajo como 'M' (gracias a resolveOriginalTurno)
    const rows = [
        { empleado_id: 'cristina', fecha: '2026-04-20', turno: 'M', tipo: 'VAC', hotel_id: 'Cumbria', sustituto: 'miriam', evento_id: 'evt1', _turnoOriginal: 'M' }
    ];
    const engine = window.TurnosEngine;
    const roster = engine.buildDayRoster({ rows, employees: [], date, hotel, sourceRows, sourceIndex: 0 });
    
    console.log('Roster Miriam:', roster.find(e => e.norm === 'miriam')?.cell);
    console.log('Roster Cristina:', roster.find(e => e.norm === 'cristina')?.cell);
}

console.log('--- TEST B: DANI <-> MACARENA ---');
{
    const date = '2026-04-25';
    const hotel = 'Sercotel';
    const sourceRows = [
        { empleadoId: 'Dani', displayName: 'Dani', rowIndex: 0, values: ['M'] },
        { empleadoId: 'Macarena', displayName: 'Macarena', rowIndex: 1, values: ['T'] }
    ];
    // En rows llegan con los turnos legacy que tenga DAO (o lo que haya generado el swap), el flag es INTERCAMBIO_TURNO
    const rows = [
        { empleado_id: 'dani', fecha: date, turno: 'T', tipo: 'CT', hotel_id: 'Sercotel', sustituto: 'macarena', evento_id: 'evt2', evento_tipo: 'INTERCAMBIO_TURNO' },
        { empleado_id: 'macarena', fecha: date, turno: 'M', tipo: 'CT', hotel_id: 'Sercotel', sustituto: 'dani', evento_id: 'evt2', evento_tipo: 'INTERCAMBIO_TURNO' }
    ];
    const engine = window.TurnosEngine;
    const roster = engine.buildDayRoster({ rows, employees: [], date, hotel, sourceRows, sourceIndex: 0 });
    
    console.log('Roster Dani:', roster.find(e => e.norm === 'dani')?.cell);
    console.log('Roster Macarena:', roster.find(e => e.norm === 'macarena')?.cell);
}
