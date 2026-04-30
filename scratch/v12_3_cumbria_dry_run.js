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

async function dryRunV123Cumbria() {
    const hotel = "Cumbria Spa&Hotel";
    const weekStart = "2026-03-30";
    const weekDates = ["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05"];

    const { data: tbase } = await client.from("turnos").select("*").eq("hotel_id", hotel).gte("fecha", weekDates[0]).lte("fecha", weekDates[6]);
    const { data: employees } = await client.from("empleados").select("nombre").eq("hotel_id", hotel).eq("estado_empresa", "activo");
    const { data: events } = await client.from("eventos_cuadrante").select("*").eq("hotel_origen", hotel).gte("fecha_inicio", weekDates[0]).lte("fecha_inicio", weekDates[6]).eq("estado", "activo");

    const enrichedRows = [];
    const rowsSkeleton = employees.map(e => ({ nombre: e.nombre, dias: {} }));

    rowsSkeleton.forEach((oldRow, idx) => {
        const empName = oldRow.nombre;
        const newCells = {};
        let forcedInformativa = false;

        weekDates.forEach(f => {
            const absenceEvent = events.find(e => e.empleado_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
            const substitutionEvent = events.find(e => e.empleado_destino_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
            const exchangeEvent = events.find(e => (e.empleado_id === empName || e.empleado_destino_id === empName) && e.fecha_inicio === f && (e.tipo === "INTERCAMBIO_TURNO" || e.tipo === "CAMBIO_TURNO"));

            if (absenceEvent) {
                newCells[f] = buildCell(absenceEvent.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                if (absenceEvent.empleado_destino_id) forcedInformativa = true;
            } else if (substitutionEvent) {
                const titName = substitutionEvent.empleado_id;
                const t = tbase.find(tb => tb.empleado_id === titName && tb.fecha === f);
                newCells[f] = buildCell(t?.turno, { origen: "SUSTITUCION", icons: ["🔄"] });
            } else if (exchangeEvent) {
                let code = (exchangeEvent.empleado_id === empName) ? exchangeEvent.turno_nuevo : exchangeEvent.turno_original;
                if (!code || code === "CT") {
                   const partner = (exchangeEvent.empleado_id === empName) ? exchangeEvent.empleado_destino_id : exchangeEvent.empleado_id;
                   const t = tbase.find(tb => tb.empleado_id === partner && tb.fecha === f);
                   code = t?.turno;
                }
                newCells[f] = buildCell(code, { origen: "EVENTO", icons: ["🔄"], changed: true });
            } else {
                const t = tbase.find(tb => tb.empleado_id === empName && tb.fecha === f);
                newCells[f] = buildCell(t?.turno || "—");
            }
        });

        enrichedRows.push({ nombre: empName, rowType: forcedInformativa ? "ausencia_informativa" : "operativa", dias: newCells });
    });

    console.log("Cumbria 30/03 V12.3:");
    const cri = enrichedRows.find(r => r.nombre === "Cristina");
    const mir = enrichedRows.find(r => r.nombre === "Miriam");
    const est = enrichedRows.find(r => r.nombre === "Esther");
    console.log(`Cristina 01/04: ${JSON.stringify(cri.dias["2026-04-01"])}`);
    console.log(`Miriam   01/04: ${JSON.stringify(mir.dias["2026-04-01"])}`);
    console.log(`Esther   01/04: ${JSON.stringify(est.dias["2026-04-01"])} [${est.rowType}]`);
}
dryRunV123Cumbria();
