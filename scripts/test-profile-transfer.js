const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../admin.js'), 'utf8');
const profile = { id: 'Cristina', nombre: 'Cristina', id_interno: 'EMP-0001', hotel_id: 'Sercotel Guadiana' };
const rows = [
    { empleado_id: 'Cristina', fecha: '2026-09-22', hotel_id: 'Cumbria Spa&Hotel', turno: 'N' },
    { empleado_id: 'EMP-0001', fecha: '2026-10-11', hotel_id: 'Cumbria Spa&Hotel', turno: 'M' },
    { empleado_id: 'Cristina', fecha: '2026-10-12', hotel_id: 'Sercotel Guadiana', turno: 'T' },
    { empleado_id: 'Esther', fecha: '2026-10-11', hotel_id: 'Cumbria Spa&Hotel', turno: 'D' }
];
const calls = [];
const window = { empleadosGlobales: [profile], _employeeProfileYear: 2026,
    isoDate: d => d.toISOString().slice(0, 10),
    TurnosDB: { fetchTurnosBase: async (...args) => { calls.push(args); return rows; }, fetchEventos: async () => [] } };
const context = vm.createContext({ window, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../shift-resolver.js'), 'utf8'), context);
const start = source.indexOf('window.loadEmployeeProfileBaseRows =');
const end = source.indexOf('window.buildEmployeeProfileModel = (empId, refISO)');
vm.runInContext(source.slice(start, end), context);
(async () => {
    await window.loadEmployeeProfileBaseRows('Cristina', '2026-10-01');
    assert.equal(calls[0][2], null, 'Load both hotels, even when current hotel has shifts');
    assert.equal(window._employeeProfileBaseRows.length, 4, 'Keep colleagues for substitution resolution');
    const hotels = window.employeeProfileHotelsByDate(profile, rows);
    assert.equal(hotels.get('2026-09-22'), 'Cumbria Spa&Hotel');
    assert.equal(hotels.get('2026-10-11'), 'Cumbria Spa&Hotel');
    assert.equal(hotels.get('2026-10-12'), 'Sercotel Guadiana');
    const flat = rows.map(row => ({ empleadoId: row.empleado_id, fecha: row.fecha, turno: row.turno }));
    const baseIndex = window.buildIndices([profile, { id: 'Esther', nombre: 'Esther' }], [], flat).baseIndex;
    Object.assign(context, { profile, emp: profile, hotelPrincipal: profile.hotel_id, hotelForDate: date => hotels.get(date) || profile.hotel_id,
        refDate: new Date('2026-10-01T12:00:00Z'), startMonth: new Date('2026-10-01T12:00:00Z'), eventos: [], baseIndex, resolveId: window.normalizeId });
    const calendarStart = source.indexOf('    const calendario = [];', end);
    const calendarEnd = source.indexOf('    const eventosActivos =', calendarStart);
    const runCalendar = () => vm.runInContext('{' + source.slice(calendarStart, calendarEnd) + '\nglobalThis.days = calendario;}', context);
    runCalendar();
    for (const [date, hotel, shift] of [['2026-10-11','Cumbria Spa&Hotel','M'], ['2026-10-12','Sercotel Guadiana','T']]) {
        const day = context.days.find(d => d.fecha === date);
        assert.equal(day.hotel, hotel); assert.equal(day.turnoBase, shift); assert.equal(day.turno, shift);
    }
    context.refDate = context.startMonth = new Date('2026-09-01T12:00:00Z');
    runCalendar();
    const september = context.days.find(d => d.fecha === '2026-09-22');
    assert.equal(september.hotel, 'Cumbria Spa&Hotel');
    assert.equal(september.turno, 'N');
    console.log('OK: both hotels loaded, aliases resolved, transfer boundary and real calendar/resolver shifts preserved.');
})().catch(error => { console.error(error); process.exitCode = 1; });
