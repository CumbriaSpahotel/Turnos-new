const assert = require('node:assert/strict');
const { mask, hide } = require('../js/hide-publication');
const cells = { '2027-01-04': { code: 'M' }, '2027-01-05': { code: 'N', sustituto: 'Persona' }, '2027-01-06': { code: 'D' } };
const publication = { id: 1, hotel: 'Cumbria Spa&Hotel', semana_inicio: '2027-01-04', semana_fin: '2027-01-10', snapshot_json: { rows: [{ cells, dias: cells, turnosOperativos: cells }] } };
(async () => {
    const result = mask(publication, '2027-01-05');
    assert.equal(result.changed, true);
    for (const key of ['cells', 'dias', 'turnosOperativos']) {
        assert.equal(result.snapshot.rows[0][key]['2027-01-04'].code, 'M');
        assert.equal(result.snapshot.rows[0][key]['2027-01-05'].publicHidden, true);
        assert.equal(result.snapshot.rows[0][key]['2027-01-05'].sustituto, undefined);
    }
    assert.equal(publication.snapshot_json.rows[0].cells['2027-01-05'].code, 'N');
    assert.equal(mask({ snapshot_json: result.snapshot }, '2027-01-05').changed, false);
    assert.throws(() => mask(publication, '2027-02-30'), /Fecha/);
    let writes = 0;
    const api = { supabase: { from: table => {
        assert.equal(table, 'publicaciones_cuadrante');
        const q = { select: () => q, eq: () => q, gte: () => q, order: () => q, range: () => q,
            then: resolve => Promise.resolve({ data: [publication, { ...publication, id: 2 }] }).then(resolve) }; return q;
    } }, TurnosDB: { publishCuadranteSnapshot: async args => { writes++; assert.equal(args.hotel, publication.hotel); return { success: true }; } } };
    assert.equal(await hide(api, '2027-01-05', 'all'), 1);
    assert.equal(writes, 1);
    api.TurnosDB.publishCuadranteSnapshot = async () => ({ success: true, needsManualCleanup: true });
    await assert.rejects(hide(api, '2027-01-05', 'all'), e => e.completed === 1);
    console.log('OK: inclusive cutoff, previous days preserved, all render maps masked, idempotence, deduplication and cleanup failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
