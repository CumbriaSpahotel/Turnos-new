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

async function publishV123() {
    const scope = [
        { hotel: "Cumbria Spa&Hotel", week: "2026-03-30" },
        { hotel: "Sercotel Guadiana", week: "2026-04-13" },
        { hotel: "Sercotel Guadiana", week: "2026-04-20" },
        { hotel: "Sercotel Guadiana", week: "2026-04-27" }
    ];

    let excelOrderRaw = [];
    try { excelOrderRaw = JSON.parse(fs.readFileSync("data/v9_excel_order_map.json", "utf8")); } catch(e){}

    console.log("--- PUBLICACIÓN CONTROLADA MOTOR V12.3: SUBSTITUTION FIX ---");

    for (const item of scope) {
        const { hotel, week: weekStart } = item;
        const weekDates = [];
        let d = new Date(weekStart + "T12:00:00");
        for(let i=0; i<7; i++) { weekDates.push(d.toISOString().split("T")[0]); d.setDate(d.getDate()+1); }

        const { data: tbase } = await client.from("turnos").select("*").eq("hotel_id", hotel).gte("fecha", weekDates[0]).lte("fecha", weekDates[6]);
        const { data: snaps } = await client.from("publicaciones_cuadrante").select("*").eq("hotel", hotel).eq("semana_inicio", weekStart).order("version", { ascending: false });
        
        let baseSnap = snaps.find(s => s.publicado_por !== "IA_V12_1_FINAL" && s.publicado_por !== "IA_V12_2_ENRICHMENT" && s.publicado_por !== "IA_V12_3_SUBSTITUTION_FIX");
        let rows = [];
        if (baseSnap) {
            rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];
        } else {
            const { data: employees } = await client.from("empleados").select("nombre").eq("hotel_id", hotel).eq("estado_empresa", "activo");
            rows = employees.map(e => ({ nombre: e.nombre, dias: {} }));
        }

        const { data: events } = await client.from("eventos_cuadrante").select("*").eq("hotel_origen", hotel).gte("fecha_inicio", weekDates[0]).lte("fecha_inicio", weekDates[6]).eq("estado", "activo");

        const orderLookup = {};
        excelOrderRaw.filter(o => o.hotel === hotel && o.week_start === weekStart).forEach(o => {
            orderLookup[o.empleado_nombre] = o.order % 100;
        });

        const enrichedRows = [];
        rows.forEach((oldRow, idx) => {
            const empName = oldRow.nombre;
            const newCells = {};
            let forcedInformativa = false;

            weekDates.forEach(f => {
                const absEv = events.find(e => e.empleado_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
                const substEv = events.find(e => e.empleado_destino_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
                const exchEv = events.find(e => (e.empleado_id === empName || e.empleado_destino_id === empName) && e.fecha_inicio === f && (e.tipo === "INTERCAMBIO_TURNO" || e.tipo === "CAMBIO_TURNO"));

                if (absEv) {
                    newCells[f] = buildCell(absEv.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                    if (absEv.empleado_destino_id) forcedInformativa = true;
                } else if (substEv) {
                    const titName = substEv.empleado_id;
                    const titRow = rows.find(r => r.nombre === titName);
                    let code = (titRow?.dias || titRow?.cells || {})[f]?.code;
                    if (!code || code === "—") {
                        const t = tbase.find(tb => tb.empleado_id === titName && tb.fecha === f);
                        code = t?.turno;
                    }
                    newCells[f] = buildCell(code, { origen: "SUSTITUCION", icons: ["🔄"] });
                } else if (exchEv) {
                    let code = (exchEv.empleado_id === empName) ? exchEv.turno_nuevo : exchEv.turno_original;
                    if (!code || code === "CT") {
                       const partner = (exchEv.empleado_id === empName) ? exchEv.empleado_destino_id : exchEv.empleado_id;
                       const pRow = rows.find(r => r.nombre === partner);
                       code = (pRow?.dias || pRow?.cells || {})[f]?.code;
                       if (!code || code === "—") {
                           const t = tbase.find(tb => tb.empleado_id === partner && tb.fecha === f);
                           code = t?.turno;
                       }
                    }
                    newCells[f] = buildCell(code, { origen: "EVENTO", icons: ["🔄"], changed: true });
                } else {
                    const c = (oldRow.dias || oldRow.cells || {})[f];
                    let code = c?.code;
                    if (!code || code === "—") {
                        const t = tbase.find(tb => tb.empleado_id === empName && tb.fecha === f);
                        code = t?.turno;
                    }
                    newCells[f] = buildCell(code || "—");
                }
            });

            let po = orderLookup[empName] || (Number(oldRow.puestoOrden) < 900 ? oldRow.puestoOrden : idx + 1);
            enrichedRows.push({
                nombre: empName,
                puestoOrden: po,
                rowType: forcedInformativa ? "ausencia_informativa" : "operativa",
                dias: newCells,
                cells: newCells
            });
        });

        const finalRows = [
            ...enrichedRows.filter(r => r.rowType === "operativa").sort((a,b) => a.puestoOrden - b.puestoOrden),
            ...enrichedRows.filter(r => r.rowType === "ausencia_informativa").sort((a,b) => a.puestoOrden - b.puestoOrden)
        ];

        // VALIDACIÓN
        const hasCT = JSON.stringify(finalRows).includes('"code":"CT"') || JSON.stringify(finalRows).includes('"label":"CT"');
        const hasBadOrder = finalRows.some(r => r.rowType === "operativa" && r.puestoOrden > 900);
        
        if (hasCT || hasBadOrder) {
            console.error(`[${hotel} ${weekStart}] ❌ VALIDACIÓN FALLIDA. CT: ${hasCT}, BadOrder: ${hasBadOrder}.`);
            continue;
        }

        const nextVersion = (snaps[0]?.version || 0) + 1;
        const rollbackTarget = snaps[0]?.id || null;

        const record = {
            hotel, semana_inicio: weekStart, semana_fin: weekDates[6],
            snapshot_json: { hotel, semana_inicio: weekStart, rows: finalRows, empleados: finalRows },
            version: Math.max(nextVersion, 130), // Versión alta distintiva V12.3
            estado: "activo",
            publicado_por: "IA_V12_3_SUBSTITUTION_FIX",
            resumen: { source: "admin_preview_resolved_v12_3", rollback_target: rollbackTarget, substitution_fix: true }
        };

        const { data: insData, error: insErr } = await client.from("publicaciones_cuadrante").insert([record]).select();
        if (insErr) console.error(`[${hotel} ${weekStart}] ❌ ERROR:`, insErr);
        else console.log(`[${hotel} ${weekStart}] ✅ PUBLICADO. ID: ${insData[0].id} Version: ${insData[0].version}`);
    }
}
publishV123();
