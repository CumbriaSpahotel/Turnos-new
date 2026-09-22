const assert = require('node:assert/strict');
const { weeks, prepare, publish } = require('../js/annual-publication');
const hotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
const end = start => { const d = new Date(start + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); };
(async () => {
    let writes = 0, validations = 0;
    const api = {
        buildPublicationSnapshotPreview: async week => hotels.map(hotel => ({ hotel_id: hotel, week_start: week, week_end: end(week), rows: [{ nombre: 'Prueba' }] })),
        validatePublicationSnapshot: async () => { validations++; return { ok: true, warnings: [] }; },
        hasPendingPublicationChanges: async () => ({ hasChanges: true }),
        TurnosDB: { publishCuadranteSnapshot: async () => { writes++; return { success: true }; } }
    };
    assert.equal(weeks('2027-01-04').length, 52);
    assert.throws(() => weeks('2027-01-05'), /lunes/);
    const plan = await prepare(api, '2027-01-04');
    assert.equal(plan.end, '2028-01-02'); assert.equal(plan.items.length, 104);
    assert.equal(validations, 52); assert.equal(writes, 0);
    const result = await publish(api, plan);
    assert.equal(result.published, 104); assert.equal(writes, 104);
    api.hasPendingPublicationChanges = async () => ({ hasChanges: false });
    assert.equal((await publish(api, plan)).unchanged, 104); assert.equal(writes, 104);
    api.hasPendingPublicationChanges = async () => ({ hasChanges: true });
    api.TurnosDB.publishCuadranteSnapshot = async () => { throw new Error('Sin conexión'); };
    await assert.rejects(publish(api, plan), e => e.progress.published === 0 && e.message === 'Sin conexión');
    api.TurnosDB.publishCuadranteSnapshot = async () => ({ success: true, needsManualCleanup: true, warning: 'Revisar versiones' });
    await assert.rejects(publish(api, plan), e => e.progress.published === 1 && e.progress.warnings.length === 1);
    api.validatePublicationSnapshot = async () => ({ ok: false, errors: ['Turno incompleto'] });
    await assert.rejects(prepare(api, '2027-01-04'), /Turno incompleto/);
    api.buildPublicationSnapshotPreview = async () => [];
    await assert.rejects(prepare(api, '2027-01-04'), /Faltan datos/);
    console.log('OK: 52 weeks, both hotels, no writes before review, validation, unchanged snapshots, partial failure and cleanup warning.');
})().catch(error => { console.error(error); process.exitCode = 1; });
