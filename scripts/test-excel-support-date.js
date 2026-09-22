const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../admin.js'), 'utf8');
const window = { normalizeId: value => String(value || '').trim().toLowerCase(), isoDate: d => d.toISOString().slice(0, 10) };
const context = vm.createContext({ window });
vm.runInContext(source.slice(source.indexOf('window.isExcelCoverageSupport ='), source.indexOf('window.renderExcelView =')), context);
const diana = { id: 'Diana', id_interno: 'EMP-0009', tipo_personal: 'apoyo' };
const support = window.isExcelCoverageSupport;
assert.equal(support(diana, '2026-09-21'), false);
assert.equal(support(diana, '2027-11-11'), false);
assert.equal(support(diana, '2027-11-12'), true);
assert.equal(support(diana, '2027-11-13'), true);
assert.equal(support({ id: 'EMP-0009' }, '2027-11-12'), true);
assert.equal(support({ id: 'Natalio', tipo_personal: 'apoyo' }, '2027-11-12'), false);
assert.equal(support({ id: 'Sergio Sánchez', tipo_personal: 'apoyo' }, '2026-09-24'), true);
assert.equal(support({ id: 'Dani', tipo_personal: 'fijo' }, '2027-11-12'), false);
context.dateStart = '2026-01-01'; context.dateEnd = '2028-12-31';
context.TURNO_MAP = {}; context.excelShiftCoverageCode = v => v;
context._isSupport = (id, date) => support(id === 'Diana' ? diana : { id, tipo_personal: 'fijo' }, date);
vm.runInContext(source.slice(source.indexOf('        const buildExcelCoverageWarnings ='), source.indexOf('        const renderExcelCoverageWarnings =')) + '\nglobalThis.warnings = buildExcelCoverageWarnings;', context);
function rows(weekStart) {
    return [['Dani', 'N'], ['Macarena', 'M'], ['Diana', 'T'], ['Federico', 'D']].map(([empId, turno]) => ({ empId, weekStart, hasValidId: true, values: Array(7).fill(turno) }));
}
assert.equal(context.warnings(rows('2026-09-21')).length, 0);
assert.deepEqual(Array.from(context.warnings(rows('2027-11-08')), w => w.date), ['2027-11-12', '2027-11-13', '2027-11-14']);
assert.ok(source.includes('const isSupport = _isSupport(row.empId, dStr);'));
assert.ok(source.includes('data-support="${isSupport ?'));
console.log('OK: September coverage, date boundary, mixed week and other employee types.');
