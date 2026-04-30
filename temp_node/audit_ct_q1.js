const { createClient } = require("@supabase/supabase-js");
const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

async function auditQ1() {
    const { data, error } = await client
        .from("publicaciones_cuadrante")
        .select("*")
        .eq("version", 121)
        .gte("semana_inicio", "2026-01-01")
        .lte("semana_inicio", "2026-03-31");

    if (error) {
        console.error("Error fetching snapshots:", error);
        return;
    }

    const ctFound = [];
    data.forEach(snap => {
        const rows = snap.snapshot_json.rows || snap.snapshot_json.empleados || [];
        rows.forEach(emp => {
            const cells = emp.dias || emp.cells || {};
            Object.entries(cells).forEach(([fecha, cell]) => {
                const code = String(cell.code || "").toUpperCase();
                const type = String(cell.type || "").toUpperCase();
                const label = String(cell.label || "").toUpperCase();
                const origen = String(cell.origen || "").toUpperCase();

                const isCt = code === "CT" || type === "CT" || label === "CT" || 
                             ((origen.includes("CAMBIO") || origen.includes("INTERCAMBIO")) && (code === "—" || code === ""));

                if (isCt) {
                    ctFound.push({
                        hotel: snap.hotel,
                        semana: snap.semana_inicio,
                        empleado: emp.nombre,
                        fecha,
                        code,
                        type,
                        label,
                        origen
                    });
                }
            });
        });
    });

    console.log("JSON_START");
    console.log(JSON.stringify({ total: ctFound.length, items: ctFound }));
    console.log("JSON_END");
}
auditQ1();
