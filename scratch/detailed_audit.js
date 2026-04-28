
async function auditWeek(week) {
    console.log("--- START AUDIT: " + week + " ---");
    const snapshots = await window.buildPublicationSnapshotPreview(week, "Cumbria Spa&Hotel");
    const snap = snapshots[0];
    if (!snap) throw new Error("Snap not found");
    
    // Extract Miriam and Sergio for 04/05
    const auditRows = snap.rows.filter(r => 
        r.nombreVisible.toUpperCase().includes("MIRIAM") || 
        r.nombreVisible.toUpperCase().includes("SERGIO") ||
        r.rowType === "ausencia_informativa"
    ).map(r => ({
        puestoOrden: r.puestoOrden,
        nombreVisible: r.nombreVisible,
        rowType: r.rowType,
        employee_id: r.empleado_id,
        titularOriginalId: r.titularOriginalId,
        firstDay: r.cells[Object.keys(r.cells)[0]]
    }));

    const validation = await window.validatePublicationSnapshot(snapshots);
    
    return { week, auditRows, validation, fullSnapRowsCount: snap.rows.length };
}

(async () => {
    try {
        const results = [];
        results.push(await auditWeek("2026-05-04"));
        results.push(await auditWeek("2026-05-11"));
        window._auditResult = results;
        console.log("AUDIT_SUCCESS", results);
    } catch (e) {
        window._auditResult = { error: e.message, stack: e.stack };
        console.error("AUDIT_ERROR", e);
    }
})();
