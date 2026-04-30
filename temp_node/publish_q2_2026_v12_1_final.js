const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

const ABSENCE_TYPES = new Set(["VAC", "BAJA", "IT", "PERM", "PERMISO", "FORM"]);
const TURNO_LABELS = { "M": "Mañana", "T": "Tarde", "N": "Noche", "D": "Descanso", "VAC": "Vacaciones", "BAJA": "Baja", "PERM": "Permiso", "FORM": "Formación" };

const EXPLICIT_BLOCK = [
    { hotel: "Cumbria Spa&Hotel", week: "2026-03-30" },
    { hotel: "Sercotel Guadiana", week: "2026-04-06" },
    { hotel: "Sercotel Guadiana", week: "2026-04-13" }
];

function buildCell(code, extra = {}) {
    let c = String(code || "").toUpperCase().trim();
    if (c === "MAÑANA" || c === "MANANA") c = "M";
    if (c === "TARDE") c = "T";
    if (c === "NOCHE") c = "N";
    if (c === "DESCANSO") c = "D";
    if (c.startsWith("VAC")) c = "VAC";
    else if (c.startsWith("BAJA")) c = "BAJA";
    else if (c.startsWith("IT")) c = "BAJA";
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

async function publishQ2() {
    console.log("Iniciando PUBLICACIÓN FINAL Q2 2026 (V122 con PuestoOrden y Empleados Fix)...");
    
    let audit;
    try { audit = JSON.parse(fs.readFileSync("scratch/audit_q2_2026_v12_1.json", "utf8")); } catch(e) { return; }

    const aptaWeeks = audit.results.filter(r => r.status === "OK");
    const authorizedWeeks = aptaWeeks.filter(w => !EXPLICIT_BLOCK.some(b => b.hotel === w.hotel && b.week === w.week));

    const { data: events } = await client.from("eventos_cuadrante").select("*").gte("fecha_inicio", "2026-03-30").lte("fecha_inicio", "2026-07-06");
    const { data: legacySnaps } = await client.from("publicaciones_cuadrante").select("*").gte("semana_inicio", "2026-03-30").lte("semana_inicio", "2026-06-29");

    let excelOrderRaw = [];
    try { excelOrderRaw = JSON.parse(fs.readFileSync("data/v9_excel_order_map.json", "utf8")); } catch(e){}

    const results = { published: [], skipped: [] };

    for (const weekInfo of authorizedWeeks) {
        const { week: weekStart, hotel } = weekInfo;
        const weekDates = [];
        let d = new Date(weekStart + "T12:00:00");
        for(let i=0; i<7; i++) { weekDates.push(d.toISOString().split("T")[0]); d.setDate(d.getDate()+1); }

        const weekEvents = events.filter(e => e.hotel_origen === hotel && e.fecha_inicio >= weekDates[0] && e.fecha_inicio <= weekDates[6]);
        const baseSnap = legacySnaps.filter(s => s.hotel === hotel && s.semana_inicio === weekStart).sort((a,b) => b.version - a.version)[0];
        
        if (!baseSnap) { results.skipped.push({ hotel, weekStart, reason: "NO_BASE_SNAP" }); continue; }

        const orderLookup = {};
        excelOrderRaw.filter(o => o.hotel === hotel && o.week_start === weekStart).forEach(o => {
            orderLookup[o.empleado_nombre] = o.order % 100;
        });

        const rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];
        const operationalRows = [];
        const absentRows = [];

        const absenceMap = {};
        const exchangeMap = {};
        const substitutionMap = {};

        weekEvents.forEach(e => {
            const key = `${e.fecha_inicio}::${e.empleado_id}`;
            if (ABSENCE_TYPES.has(e.tipo) && e.estado === "activo") {
                absenceMap[key] = { tipo: e.tipo, sustituto: e.sustituto_id, evento_id: e.id };
                if (e.sustituto_id) substitutionMap[`${e.fecha_inicio}::${e.sustituto_id}`] = { titular: e.empleado_id, evento_id: e.id };
            }
            if ((e.tipo === "INTERCAMBIO_TURNO" || e.tipo === "CAMBIO_TURNO") && e.estado === "activo") {
                let tFinal = e.turno_nuevo;
                if (tFinal === "CT" || tFinal === "") {
                    const pr = rows.find(r => r.nombre === e.empleado_destino_id);
                    if (pr) { const cl = (pr.dias || pr.cells || {})[e.fecha_inicio]; if (cl?.code && cl.code !== "CT") tFinal = cl.code; }
                }
                exchangeMap[key] = { con: e.empleado_destino_id, turno: tFinal, evento_id: e.id };
                if (e.empleado_destino_id) {
                    let tE2 = e.turno_original;
                    if (tE2 === "CT" || tE2 === "") {
                        const pr1 = rows.find(r => r.nombre === e.empleado_id);
                        if (pr1) { const cl1 = (pr1.dias || pr1.cells || {})[e.fecha_inicio]; if (cl1?.code && cl1.code !== "CT") tE2 = cl1.code; }
                    }
                    exchangeMap[`${e.fecha_inicio}::${e.empleado_destino_id}`] = { con: e.empleado_id, turno: tE2, evento_id: e.id };
                }
            }
        });

        rows.forEach(oldRow => {
            const empName = oldRow.nombre;
            const cells = {};
            let isTitularAusente = false;

            weekDates.forEach(f => {
                const k = `${f}::${empName}`;
                if (absenceMap[k]) { cells[f] = buildCell(absenceMap[k].tipo, { origen: "EVENTO", icons: ["🏖️"] }); isTitularAusente = true; }
                else if (exchangeMap[k]) cells[f] = buildCell(exchangeMap[k].turno, { origen: "INTERCAMBIO_TURNO", icons: ["🔄"], changed: true });
                else if (substitutionMap[k]) {
                    const tit = rows.find(r => r.nombre === substitutionMap[k].titular);
                    cells[f] = buildCell(tit?.dias?.[f]?.code || "—", { origen: "EVENTO" });
                } else cells[f] = buildCell(oldRow.dias?.[f]?.code || "—");
            });

            let po = orderLookup[empName] || (Number(oldRow.puestoOrden) < 900 ? oldRow.puestoOrden : null);
            if (po === null) po = rows.indexOf(oldRow) + 1;

            const newRow = { nombre: empName, puestoOrden: po, rowType: isTitularAusente ? "ausencia_informativa" : "operativa", dias: cells, empleados: null };
            if (isTitularAusente) absentRows.push(newRow); else operationalRows.push(newRow);
        });

        const finalRows = [...operationalRows.sort((a,b)=>a.puestoOrden - b.puestoOrden), ...absentRows];
        const dbRecord = {
            hotel, semana_inicio: weekStart, semana_fin: weekDates[6],
            snapshot_json: { hotel, semana_inicio: weekStart, empleados: finalRows, rows: finalRows },
            version: 122, estado: "activo", publicado_por: "IA_V12_1_FINAL",
            resumen: { source: "admin_preview_resolved", fixed_order: true, dual_keys: true }
        };

        const { error: insErr } = await client.from("publicaciones_cuadrante").insert([dbRecord]);
        if (!insErr) results.published.push(`${hotel}_${weekStart}`);
    }
    console.log(`TOTAL V122: ${results.published.length} semanas publicadas.`);
}
publishQ2();
