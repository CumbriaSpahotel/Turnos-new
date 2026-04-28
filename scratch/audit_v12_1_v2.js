
async function runAudit() {
    const weeks = ["2026-05-04", "2026-05-11", "2026-05-18", "2026-05-25"];
    const results = {};
    
    if (window.loadAdminExcelSourceRows) await window.loadAdminExcelSourceRows();

    for (const week of weeks) {
        console.log("Auditing " + week);
        const snapshots = await window.buildPublicationSnapshotPreview(week, "Cumbria Spa&Hotel");
        const snap = snapshots[0];
        const validation = await window.validatePublicationSnapshot(snapshots);
        
        // Target names for filtering to keep it small
        const targets = ["MIRIAM", "SERGIO", "ESTHER", "NATALIO", "ESTELA", "MARIA ESTELA", "MARIA ESTELA PEINADO"];
        
        const auditedRows = snap.rows.filter(r => 
            targets.some(t => r.nombreVisible.toUpperCase().includes(t)) || 
            r.rowType === 'ausencia_informativa'
        ).map(r => ({
            puestoOrden: r.puestoOrden,
            nombreVisible: r.nombreVisible,
            rowType: r.rowType,
            employee_id: r.empleado_id,
            titularOriginalId: r.titularOriginalId || null,
            cells: Object.entries(r.cells).reduce((acc, [date, cell]) => {
                acc[date] = {
                    code: cell.code,
                    type: cell.type,
                    label: cell.label,
                    icons: cell.icons
                };
                return acc;
            }, {})
        }));

        results[week] = {
            rowCount: snap.rows.length,
            rows: auditedRows,
            validation: validation.length ? validation : "OK"
        };
    }
    return results;
}

runAudit().then(res => {
    // Render JSON to a visible div so we can read it easily
    const pre = document.createElement('pre');
    pre.id = "audit-output";
    pre.style = "white-space: pre-wrap; font-family: monospace; padding: 20px; background: #eee; border: 1px solid #ccc;";
    pre.textContent = JSON.stringify(res, null, 2);
    document.body.prepend(pre);
    window._AUDIT_DONE = true;
});
