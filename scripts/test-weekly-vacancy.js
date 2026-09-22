const assert = require('node:assert/strict');
const { assign, addDays } = require('../js/weekly-vacancy');
const employee = { id: 'Suplente', nombre: 'Suplente', id_interno: 'EMP-0099', activo: true };
const params = { vacancy: 'vacante-cumbria-1', hotel: 'Cumbria Spa&Hotel', week: '2026-10-12', start: '2026-10-12', end: '2026-10-18', employee };
const original = Array.from({ length: 21 }, (_, n) => ({ empleado_id: params.vacancy, hotel_id: params.hotel, fecha: addDays('2026-10-05', n), turno: ['T', 'D', 'D', 'T', 'T', 'N', 'N'][n % 7], tipo: 'NORMAL' }));
function client(rows, fail = false) {
    return { rows, updates: 0, from(table) {
        assert.equal(table, 'turnos');
        let patch; const filters = [];
        const q = {
            select() { return q; },
            update(value) { patch = value; return q; },
            eq(key, value) { filters.push(r => r[key] === value); return q; },
            in(key, values) { filters.push(r => values.includes(r[key])); return q; },
            gte(key, value) { filters.push(r => r[key] >= value); return q; },
            lte(key, value) { filters.push(r => r[key] <= value); return q; },
            then(resolve, reject) {
                const selected = rows.filter(r => filters.every(f => f(r)));
                if (patch) {
                    if (fail) return Promise.resolve({ error: { code: '23505' } }).then(resolve, reject);
                    thisClient.updates++;
                    selected.forEach(r => Object.assign(r, patch));
                }
                return Promise.resolve({ data: selected.map(r => ({ ...r })) }).then(resolve, reject);
            }
        };
        const thisClient = this;
        return q;
    } };
}
(async () => {
    let db = client(structuredClone(original));
    const saved = await assign(db, params);
    assert.equal(saved.length, 7); assert.equal(db.updates, 1);
    db.rows.forEach((r, n) => {
        assert.equal(r.turno, original[n].turno);
        assert.equal(r.tipo, original[n].tipo);
        assert.equal(r.empleado_id, n >= 7 && n < 14 ? employee.id : params.vacancy);
    });
    await assert.rejects(assign(db, params), /plaza ya ha cambiado/);
    db = client(structuredClone(original));
    await assign(db, { ...params, start: '2026-10-14', end: '2026-10-16' });
    assert.equal(db.rows.filter(r => r.empleado_id === employee.id).length, 3);
    for (const alias of [employee.id, employee.id_interno]) {
        db = client([...structuredClone(original), { empleado_id: alias, fecha: params.start, hotel_id: 'Otro hotel', turno: 'D' }]);
        await assert.rejects(assign(db, params), /ya tiene turnos/);
        assert.equal(db.updates, 0);
    }
    db = client(structuredClone(original));
    await assert.rejects(assign(db, { ...params, end: '2026-10-19' }), /dentro de esta semana/);
    await assert.rejects(assign(db, { ...params, employee: { ...employee, activo: false } }), /empleado activo/);
    await assert.rejects(assign(db, { ...params, start: '2026-02-30' }), /dentro de esta semana/);
    assert.equal(db.updates, 0);
    db = client(structuredClone(original), true);
    await assert.rejects(assign(db, params), /No se ha asignado la semana/);
    assert.deepEqual(db.rows, original);
    console.log('OK: full/partial week, preserved shifts and adjacent weeks, aliases, conflicts, invalid dates, repeat and atomic failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
