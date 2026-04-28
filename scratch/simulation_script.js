
async function validateV12_1() {
    const weeks = ["2026-05-04", "2026-05-11", "2026-05-18", "2026-05-25"];
    const results = {};

    for (const week of weeks) {
        console.log(`[SIMULATION] Generating preview for ${week}...`);
        const snapshots = await window.buildPublicationSnapshotPreview(week, "Cumbria Spa&Hotel");
        const snap = snapshots[0]; // Cumbria
        
        if (!snap) {
            results[week] = { error: "No snapshot generated for Cumbria" };
            continue;
        }

        const validation = await window.validatePublicationSnapshot(snapshots);
        
        // Extraer filas de interés
        const targetNames = ["MIRIAM", "SERGIO", "ESTHER", "NATALIO", "ESTELA", "MARIA ESTELA", "MARIA ESTELA PEINADO"];
        const interestingRows = snap.rows.filter(r => 
            targetNames.some(t => r.nombreVisible.toUpperCase().includes(t)) || 
            r.rowType === 'ausencia_informativa'
        );

        results[week] = {
            snapshot: {
                week_start: snap.week_start,
                rowCount: snap.rows.length,
                rows: snap.rows.map(r => ({
                    puestoOrden: r.puestoOrden,
                    nombreVisible: r.nombreVisible,
                    employee_id: r.empleado_id,
                    rowType: r.rowType,
                    titularOriginalId: r.titularOriginalId,
                    cells: r.cells
                }))
            },
            validation
        };
    }
    return results;
}

window._validationResult = "PENDING";
validateV12_1().then(res => {
    window._validationResult = res;
}).catch(err => {
    window._validationResult = { error: err.message };
});
