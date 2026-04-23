/*  debug-turnos.js
    Script de diagnóstico — pégalo en la consola del navegador (F12)
    o añade <script src="debug-turnos.js"></script> temporalmente en index.html / admin.html

    Qué hace:
    1. Llama a fetchRangoCalculado() para la semana actual
    2. Muestra las filas ANTES y DESPUÉS de aplicarEventosCuadrante()
    3. Llama a buildDayRoster() para cada día y muestra el resultado
    4. Responde: ¿el problema está en el DAO o en el engine?
*/

(async function diagnostico() {
    console.group('%c🔍 DIAGNÓSTICO TURNOSWEB', 'color:#1677ff; font-size:1.1rem; font-weight:bold;');

    // ── Utilidades ────────────────────────────────────────────
    const pad = n => String(n).padStart(2, '0');
    function mondayISO(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    }
    function addDays(iso, n) {
        const d = new Date(iso + 'T12:00:00');
        d.setDate(d.getDate() + n);
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    }

    const startISO = mondayISO();
    const endISO   = addDays(startISO, 6);
    console.log(`Semana: ${startISO} → ${endISO}`);

    // ── PASO 1: fetchRango() (filas base de Supabase sin eventos) ──
    console.group('PASO 1 — fetchRango() — filas base de Supabase');
    let baseRows = [];
    try {
        baseRows = await window.TurnosDB.fetchRango(startISO, endISO);
        console.log(`Total filas base: ${baseRows.length}`);
        console.table(baseRows.map(r => ({
            empleado_id: r.empleado_id,
            fecha:       r.fecha,
            turno:       r.turno,
            tipo:        r.tipo,
            sustituto:   r.sustituto,
            hotel_id:    r.hotel_id,
            evento_id:   r.evento_id || '—'
        })));
    } catch(e) {
        console.error('fetchRango falló:', e);
    }
    console.groupEnd();

    // ── PASO 2: fetchEventos() ─────────────────────────────────
    console.group('PASO 2 — fetchEventos() — eventos activos del periodo');
    let eventos = [];
    try {
        eventos = await window.TurnosDB.fetchEventos(startISO, endISO);
        console.log(`Total eventos: ${eventos.length}`);
        if (eventos.length) {
            console.table(eventos.map(e => ({
                id:                  e.id,
                tipo:                e.tipo,
                estado:              e.estado,
                empleado_id:         e.empleado_id,
                empleado_destino_id: e.empleado_destino_id || '—',
                turno_nuevo:         e.turno_nuevo || '—',
                fecha_inicio:        e.fecha_inicio,
                fecha_fin:           e.fecha_fin || e.fecha_inicio
            })));
        } else {
            console.warn('⚠️ NO HAY EVENTOS para esta semana. Si esperabas sustituciones o cambios, los eventos NO están guardados en Supabase.');
        }
    } catch(e) {
        console.error('fetchEventos falló:', e);
    }
    console.groupEnd();

    // ── PASO 3: fetchRangoCalculado() (DAO devuelve datos crudos) ──
    console.group('PASO 3 — fetchRangoCalculado() — datos crudos');
    let dataCruda = { rows: [], eventos: [] };
    try {
        dataCruda = await window.TurnosDB.fetchRangoCalculado(startISO, endISO);
        console.log(`Total filas base (rows): ${dataCruda.rows.length}`);
        console.log(`Total eventos: ${dataCruda.eventos.length}`);

        if (dataCruda.rows.length === 0 && dataCruda.eventos.length === 0) {
            console.warn('⚠️ NO HAY DATOS para esta semana en Supabase.');
        }
    } catch(e) {
        console.error('fetchRangoCalculado falló:', e);
    }
    console.groupEnd();

    // ── PASO 4: buildDayRoster() — lunes de la semana ──────────
    console.group('PASO 4 — buildDayRoster() — lunes de la semana (primer día)');
    try {
        if (!window.ExcelLoader || !window.TurnosEngine) {
            console.warn('ExcelLoader o TurnosEngine no disponibles. Abre la página a través del servidor (no file://).');
        } else {
            const excelSource = await window.ExcelLoader.loadExcelSourceRows();
            const profiles    = await window.TurnosDB.getEmpleados();
            const hotels      = await window.TurnosDB.getHotels();
            console.log('Hoteles detectados:', hotels);
            console.log('Empleados (perfiles):', profiles.length);

            for (const hotel of hotels) {
                console.group(`Hotel: ${hotel}`);
                const weekExcelRows = (excelSource[hotel] || []).filter(r => r.weekStart === startISO);
                console.log(`Excel rows para semana ${startISO}: ${weekExcelRows.length}`);

                if (weekExcelRows.length === 0) {
                    console.warn(`⚠️ Sin filas de Excel para ${hotel} en la semana ${startISO}. El orden vendrá de Supabase, no del Excel.`);
                }

                const rosterId = window.TurnosEngine.buildDayRoster({
                    rows:        dataCruda.rows,
                    events:      dataCruda.eventos,
                    employees:   profiles,
                    date:        startISO,
                    hotel,
                    sourceRows:  weekExcelRows,
                    sourceIndex: 0
                });

                console.log(`Entradas en roster del lunes: ${rosterId.length}`);
                console.table(rosterId.map(e => ({
                    name:     e.name,
                    isAbsent: e.isAbsent,
                    turno:    e.cell?.turno || '—',
                    tipo:     e.cell?.tipo || '—',
                    sustituto: e.cell?.sustituto || '—',
                    coveringFor: e.cell?.coveringFor || '—',
                    evento_id: e.cell?.evento_id || '—',
                    estadoFinal: e._finalState?.estadoFinal || '—',
                    razon:    e._finalState?.sourceReason || '—'
                })));
                console.groupEnd();
            }
        }
    } catch(e) {
        console.error('buildDayRoster falló:', e);
    }
    console.groupEnd();

    // ── CONCLUSIÓN AUTOMÁTICA ──────────────────────────────────
    console.group('%c📋 DIAGNÓSTICO AUTOMÁTICO', 'color:#f08c00; font-weight:bold;');
    const tieneEventos = dataCruda.eventos.length > 0;
    const tieneRows = dataCruda.rows.length > 0;

    console.log(`Eventos en Supabase esta semana: ${tieneEventos ? '✅ SÍ' : '❌ NO'}`);
    console.log(`Filas base (rows) en Supabase: ${tieneRows ? '✅ SÍ' : '❌ NO'}`);

    if (!tieneRows && !tieneEventos) {
        console.error('🔴 DIAGNÓSTICO: No hay datos en Supabase para este periodo.');
    } else {
        console.log('🟢 DIAGNÓSTICO: El DAO está entregando datos crudos. La resolución ahora depende de ShiftResolver en el Engine.');
    }
    console.groupEnd();

    console.groupEnd(); // fin grupo principal
})();
