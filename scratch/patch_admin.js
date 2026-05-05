const fs = require('fs');
const path = 'admin.js';
let content = fs.readFileSync(path, 'utf8');

const target = `        // 3. Guardar Snapshots en publicaciones_cuadrante
        console.log("[PUBLISH_EXECUTE] saving snapshots", snapshots.length);
        for (const snap of snapshots) {
            console.log("[PUBLISH_EXECUTE] publishing hotel", snap.hotel_id);
            await window.TurnosDB.publishCuadranteSnapshot({
                semanaInicio: snap.week_start,
                semanaFin: snap.week_end,
                hotel: snap.hotel_id,
                snapshot: snap,
                resumen: { emps: snap.rows.length },
                usuario: 'ADMIN'
            });
        }`;

const replacement = `        // 3. Guardar Snapshots en publicaciones_cuadrante (FASE A Crítica / FASE B Best-Effort)
        console.log("[PUBLISH_EXECUTE] saving snapshots", snapshots.length);
        let globalNeedsCleanup = false;
        
        for (const snap of snapshots) {
            console.log("[PUBLISH_EXECUTE] publishing hotel", snap.hotel_id);
            const result = await window.TurnosDB.publishCuadranteSnapshot({
                semanaInicio: snap.week_start,
                semanaFin: snap.week_end,
                hotel: snap.hotel_id,
                snapshot: snap,
                resumen: { emps: snap.rows.length },
                usuario: 'ADMIN'
            });

            if (result && result.needsManualCleanup) {
                globalNeedsCleanup = true;
            }
        }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
} else {
    // Try with \r\n
    const targetRL = target.replace(/\n/g, '\r\n');
    if (content.includes(targetRL)) {
        content = content.replace(targetRL, replacement.replace(/\n/g, '\r\n'));
    } else {
        console.error("Target not found!");
        process.exit(1);
    }
}

const targetAlert = `        alert('Publicación completada con éxito.');`;
const replacementAlert = `        if (globalNeedsCleanup) {
            alert('Publicación creada correctamente.\\n\\nNOTA: Supabase bloqueó la desactivación automática de versiones anteriores por políticas de seguridad (RLS). Se requiere limpieza manual de duplicados activos desde el SQL Editor.');
        } else {
            alert('Publicación completada con éxito.');
        }`;

if (content.includes(targetAlert)) {
    content = content.replace(targetAlert, replacementAlert);
} else {
    const targetAlertRL = targetAlert.replace(/\n/g, '\r\n');
    if (content.includes(targetAlertRL)) {
        content = content.replace(targetAlertRL, replacementAlert.replace(/\n/g, '\r\n'));
    } else {
        console.error("Target Alert not found!");
        process.exit(1);
    }
}

fs.writeFileSync(path, content, 'utf8');
console.log("admin.js patched successfully.");
