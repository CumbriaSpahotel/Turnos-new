const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

const HOTELS = ["Cumbria Spa&Hotel", "Sercotel Guadiana"];
const WEEKS = [
    "2026-03-30", "2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27",
    "2026-05-04", "2026-05-11", "2026-05-18", "2026-05-25",
    "2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29"
];

const ABSENCE_TYPES = new Set(["VAC", "BAJA", "IT", "PERM", "PERMISO", "FORM"]);

async function runAudit() {
    console.log("Iniciando AUDITORÍA V12.1 REFINADA Q2 2026...");
    
    // 1. Cargar Datos Maestros
    const { data: emps } = await client.from("empleados").select("*");
    const { data: events } = await client.from("eventos_cuadrante")
        .select("*")
        .gte("fecha_inicio", "2026-03-30")
        .lte("fecha_inicio", "2026-07-06");
    
    // Simular Carga de Excel (Base Shifts)
    // Usaremos un snapshot v1 (o el excel-loader si estuviera disponible) para obtener la base.
    // Para el Dry Run, extraeremos los turnos base de los snapshots existentes de Q2.
    const { data: legacySnaps } = await client.from("publicaciones_cuadrante")
        .select("*")
        .gte("semana_inicio", "2026-03-30")
        .lte("semana_inicio", "2026-06-29")
        .order("version", { ascending: true });

    let excelOrderMap = {};
    try { excelOrderMap = JSON.parse(fs.readFileSync("data/v9_excel_order_map.json", "utf8")); } catch(e){}

    const audit = {
        meta: { range: "Q2 2026", totalWeeks: WEEKS.length * HOTELS.length },
        stats: { aptas: 0, bloqueadas: 0, ct_legacy: 0, ct_resueltos: 0, ct_bloqueados: 0 },
        results: []
    };

    for (const week of WEEKS) {
        for (const hotel of HOTELS) {
            const report = { week, hotel, status: "OK", issues: [], ct_log: [] };
            
            const weekEvents = events.filter(e => e.hotel_origen === hotel && e.fecha_inicio >= week && e.fecha_inicio <= (new Date(new Date(week).getTime() + 6*86400000).toISOString().split("T")[0]));
            
            // 1. Detección de CT en eventos
            weekEvents.forEach(e => {
                if (e.turno_original === "CT" || e.turno_nuevo === "CT") {
                    audit.stats.ct_legacy++;
                    const partners = [e.empleado_id, e.empleado_destino_id].filter(Boolean);
                    
                    // Resolución V12.1: ¿Podemos encontrar el turno real?
                    // Buscamos en el snapshot legacy v1 (base)
                    const baseSnap = legacySnaps.find(s => s.hotel === hotel && s.semana_inicio === week);
                    let resolved = false;
                    let turnoFinal = "—";

                    if (baseSnap) {
                        const rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];
                        const partnerRow = rows.find(r => r.nombre === e.empleado_destino_id || r.nombre === e.empleado_id);
                        if (partnerRow) {
                            const cell = (partnerRow.dias || partnerRow.cells || {})[e.fecha_inicio];
                            if (cell && cell.code && cell.code !== "CT" && cell.code !== "—") {
                                resolved = true;
                                turnoFinal = cell.code;
                            }
                        }
                    }

                    if (resolved) {
                        audit.stats.ct_resueltos++;
                        report.ct_log.push({ fecha: e.fecha_inicio, emps: partners, status: "RESOLVED", turno: turnoFinal });
                    } else {
                        audit.stats.ct_bloqueados++;
                        report.status = "BLOQUEADA";
                        report.issues.push(`CT persistente: ${partners.join("/")} en ${e.fecha_inicio}`);
                        report.ct_log.push({ fecha: e.fecha_inicio, emps: partners, status: "BLOCKED" });
                    }
                }
            });

            // 2. Validación Reglas V12.1
            // (Simulación de duplicados y filas vacías)
            const weekLegacy = legacySnaps.filter(s => s.hotel === hotel && s.semana_inicio === week).sort((a,b)=>b.version - a.version)[0];
            if (weekLegacy) {
                const empsInSnap = weekLegacy.snapshot_json.rows || weekLegacy.snapshot_json.empleados || [];
                const names = empsInSnap.map(e => e.nombre);
                const dups = names.filter((n, i) => names.indexOf(n) !== i);
                if (dups.length > 0) {
                    report.status = "BLOQUEADA";
                    report.issues.push(`Duplicados operativos detectados: ${dups.join(", ")}`);
                }
            }

            if (report.status === "OK") audit.stats.aptas++; else audit.stats.bloqueadas++;
            audit.results.push(report);
        }
    }

    fs.writeFileSync("scratch/audit_q2_2026_v12_1.json", JSON.stringify(audit, null, 2));
    console.log(`Auditoría Q2: ${audit.stats.aptas} APTAS, ${audit.stats.bloqueadas} BLOQUEADAS.`);
}

runAudit();
