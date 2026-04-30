const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

const ABSENCE_TYPES = new Set(["VAC", "BAJA", "IT", "PERM", "PERMISO", "FORM"]);
const TURNO_LABELS = { "M": "Mañana", "T": "Tarde", "N": "Noche", "D": "Descanso", "VAC": "Vacaciones", "BAJA": "Baja", "PERM": "Permiso", "FORM": "Formación" };

function buildCell(code, extra = {}) {
    let c = String(code || "").toUpperCase().trim();
    if (c === "MAÑANA" || c === "MANANA") c = "M";
    if (c === "TARDE") c = "T";
    if (c === "NOCHE") c = "N";
    if (c === "DESCANSO") c = "D";
    if (c.startsWith("VAC")) c = "VAC";
    else if (c.startsWith("BAJA") || c.startsWith("IT")) c = "BAJA";
    else if (c.startsWith("PERM")) c = "PERM";

    const isAbsence = ABSENCE_TYPES.has(c);
    return {
        code: c || "—",
        label: TURNO_LABELS[c] || (c || "—"),
        type: isAbsence ? c : "NORMAL",
        estado: "operativo",
        origen: extra.origen || "BASE",
        icons: extra.icons || [],
        changed: !!extra.changed,
        evento_id: extra.evento_id || null,
        sustituto: extra.sustituto || null,
        titular_cubierto: extra.titular_cubierto || null
    };
}

async function auditMayJun() {
    const hotels = ["Cumbria Spa&Hotel", "Sercotel Guadiana"];
    const weeks = [
        "2026-05-04", "2026-05-11", "2026-05-18", "2026-05-25",
        "2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22"
    ];

    let excelOrderRaw = [];
    try { excelOrderRaw = JSON.parse(fs.readFileSync("data/v9_excel_order_map.json", "utf8")); } catch(e){}

    const auditReport = { weeks: [] };

    console.log("--- AUDITORÍA DRY RUN Q2 MAYO/JUNIO V12.4 ---");

    for (const weekStart of weeks) {
        const weekDates = [];
        let d = new Date(weekStart + "T12:00:00");
        for(let i=0; i<7; i++) { weekDates.push(d.toISOString().split("T")[0]); d.setDate(d.getDate()+1); }

        for (const hotel of hotels) {
            console.log(`Auditing [${hotel}] [${weekStart}]...`);
            
            const { data: snaps } = await client.from("publicaciones_cuadrante").select("*").eq("hotel", hotel).eq("semana_inicio", weekStart).order("version", { ascending: false });
            const { data: tbase } = await client.from("turnos").select("*").eq("hotel_id", hotel).gte("fecha", weekDates[0]).lte("fecha", weekDates[6]);
            const { data: events } = await client.from("eventos_cuadrante").select("*").eq("hotel_origen", hotel).gte("fecha_inicio", weekDates[0]).lte("fecha_inicio", weekDates[6]).eq("estado", "activo");

            let baseSnap = snaps.find(s => !s.publicado_por.startsWith("IA_V12"));
            let rows = [];
            if (baseSnap) {
                rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];
            } else {
                const { data: employees } = await client.from("empleados").select("nombre").eq("hotel_id", hotel).eq("estado_empresa", "activo");
                rows = (employees || []).map(e => ({ nombre: e.nombre, dias: {} }));
            }

            const activeSubstitutes = new Set();
            events.forEach(e => { if (ABSENCE_TYPES.has(e.tipo) && e.empleado_destino_id) activeSubstitutes.add(e.empleado_destino_id); });

            const orderLookup = {};
            excelOrderRaw.filter(o => o.hotel === hotel && o.week_start === weekStart).forEach(o => {
                orderLookup[o.empleado_nombre] = o.order % 1000;
            });

            const enrichedRows = [];
            const processedAsSubstitute = new Set();

            rows.forEach((oldRow, idx) => {
                const empName = oldRow.nombre;
                if (activeSubstitutes.has(empName) && !processedAsSubstitute.has(empName)) return;

                const newCells = {};
                const infoCells = {};
                let hasSubstitution = false;
                let substituteName = null;

                weekDates.forEach(f => {
                    const absEv = events.find(e => e.empleado_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
                    const substEv = events.find(e => e.empleado_destino_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
                    const exchEv = events.find(e => (e.empleado_id === empName || e.empleado_destino_id === empName) && e.fecha_inicio === f && (e.tipo === "INTERCAMBIO_TURNO" || e.tipo === "CAMBIO_TURNO"));

                    if (absEv) {
                        infoCells[f] = buildCell(absEv.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                        if (absEv.empleado_destino_id) {
                            hasSubstitution = true;
                            substituteName = absEv.empleado_destino_id;
                            processedAsSubstitute.add(substituteName);
                            const t = tbase.find(tb => tb.empleado_id === empName && tb.fecha === f);
                            newCells[f] = buildCell(t?.turno, { origen: "SUSTITUCION", icons: ["🔄"] });
                        } else {
                            newCells[f] = buildCell(absEv.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                        }
                    } else if (substEv) {
                        const titName = substEv.empleado_id;
                        const t = tbase.find(tb => tb.empleado_id === titName && tb.fecha === f);
                        newCells[f] = buildCell(t?.turno, { origen: "SUSTITUCION", icons: ["🔄"] });
                        infoCells[f] = buildCell(t?.turno, { origen: "BASE" });
                    } else if (exchEv) {
                        let code = (exchEv.empleado_id === empName) ? exchEv.turno_nuevo : exchEv.turno_original;
                        if (!code || code === "CT") {
                            const partner = (exchEv.empleado_id === empName) ? exchEv.empleado_destino_id : exchEv.empleado_id;
                            const t = tbase.find(tb => tb.empleado_id === partner && tb.fecha === f);
                            code = t?.turno;
                        }
                        newCells[f] = buildCell(code, { origen: "EVENTO", icons: ["🔄"], changed: true });
                        infoCells[f] = buildCell(code, { origen: "BASE" });
                    } else {
                        const c = (oldRow.dias || oldRow.cells || {})[f];
                        let code = c?.code;
                        if (!code || code === "—") {
                            const t = tbase.find(tb => tb.empleado_id === empName && tb.fecha === f);
                            code = t?.turno;
                        }
                        newCells[f] = buildCell(code || "—");
                        infoCells[f] = buildCell(code || "—");
                    }
                });

                const po = orderLookup[empName] || oldRow.puestoOrden || (idx + 1);

                if (hasSubstitution) {
                    enrichedRows.push({ nombre: substituteName, puestoOrden: po, rowType: "operativa", dias: newCells, titularOriginal: empName, ocupanteVisible: substituteName });
                    enrichedRows.push({ nombre: empName, puestoOrden: po, rowType: "ausencia_informativa", dias: infoCells });
                } else {
                    enrichedRows.push({ nombre: empName, puestoOrden: po, rowType: "operativa", dias: newCells });
                }
            });

            const finalRows = [
                ...enrichedRows.filter(r => r.rowType === "operativa").sort((a,b) => a.puestoOrden - b.puestoOrden),
                ...enrichedRows.filter(r => r.rowType === "ausencia_informativa").sort((a,b) => a.puestoOrden - b.puestoOrden)
            ];

            const issues = [];
            const hasCT = JSON.stringify(finalRows).includes('"code":"CT"');
            const hasBadOrder = finalRows.some(r => r.rowType === "operativa" && r.puestoOrden > 900);
            const hasBlanks = finalRows.some(r => Object.values(r.dias).every(c => c.code === "—"));

            if (hasCT) issues.push("CT_VISIBLE");
            if (hasBadOrder) issues.push("PUESTO_ORDEN_9999");
            if (hasBlanks) issues.push("BLANK_ROWS");

            auditReport.weeks.push({
                weekStart,
                hotel,
                apt: issues.length === 0,
                issues,
                rowCount: finalRows.length,
                substitutions: enrichedRows.filter(r => !!r.titularOriginal).map(r => ({ substitute: r.nombre, titular: r.titularOriginal })),
                currentSnaps: (snaps || []).map(s => ({ version: s.version, pub: s.publicado_por, hasCT: JSON.stringify(s.snapshot_json).includes('"code":"CT"') }))
            });
        }
    }

    fs.writeFileSync("scratch/audit_may_jun_2026_v12_4.json", JSON.stringify(auditReport, null, 2));
    console.log("Auditoría completada. Reporte generado en scratch/audit_may_jun_2026_v12_4.json");
}
auditMayJun();
