(function () {
    // =========================================================
    // TURNOSWEB ENGINE v5.0 - Estabilización
    // =========================================================
    
    // Adaptador para compatibilidad con UI legacy que espera objeto 'cell'
    const adaptResultToCell = (res) => {
        if (!res) return null;
        return {
            empleado_id: res.empleadoId,
            fecha: res.fecha,
            turno: res.turno || '',
            tipo: res.incidencia || (res.cambio ? 'CT' : 'NORMAL'),
            hotel_id: res.hotel,
            sustituto: res.sustituidoPor || res.sustituyeA || null,
            coveringFor: res.sustituyeA || null,
            coveredBy: res.sustituidoPor || null,
            evento_id: res.evento?.id || null,
            evento_tipo: res.origen || null,
            _finalState: res
        };
    };

    const employeeTypeKey = (value) => window.normalizeId(value || 'fijo').replace(/\s+/g, '_');

    const employeeComputesForStats = (profile) => {
        const key = employeeTypeKey(profile?.tipo_personal || profile?.contrato);
        return key !== 'ocasional' && key !== 'eventual' && key !== 'apoyo' && key !== 'apollo';
    };

    const buildDayRoster = ({
        date,
        hotel,
        employees = [],
        events = [],
        sourceRows = [],
        sourceIndex = 0,
        baseIndex = null
    } = {}) => {
        if (!window.resolveEmployeeDay) {
            console.error('[Engine v5.0] resolveEmployeeDay no disponible');
            return [];
        }

        const entries = [];
        const renderedNorms = new Set();

        // 1. Iterar sourceRows (Excel)
        sourceRows.forEach(sRow => {
            const empId = sRow.empleadoId;
            const norm = window.normalizeId(empId);
            if (renderedNorms.has(norm)) return;

            const turnoBase = sRow.values[sourceIndex] || null;
            const profile = employees.find(e => window.normalizeId(e.id) === norm || window.normalizeId(e.nombre) === norm);

            const res = window.resolveEmployeeDay({
                empleado: profile,
                empleadoId: empId,
                hotel,
                fecha: date,
                turnoBase,
                eventos: events,
                baseIndex
            });

            const cell = adaptResultToCell(res);
            entries.push({
                norm,
                id: empId,
                name: sRow.displayName || empId,
                displayAs: sRow.displayName || empId,
                profile,
                sourceOrder: sRow.rowIndex,
                isAbsent: !!res.incidencia,
                cell,
                showStats: employeeComputesForStats(profile),
                substituting: res.sustituyeA,
                substitutedBy: res.sustituidoPor,
                _finalState: res
            });
            renderedNorms.add(norm);
        });

        // 2. Fallback: Empleados del hotel no en Excel o con eventos pero sin fila Excel
        // En esta fase de estabilización, si alguien tiene un evento (como un sustituto externo),
        // debe aparecer en el cuadrante si su hotel resultante es el actual.
        // Pero resolveEmployeeDay se llama por empleado. Necesitamos saber qué empleados tienen eventos hoy.
        const extraEmpIds = new Set();
        events.forEach(ev => {
            const a = ev.empleado_id || ev.empleado_a_id || ev.origen_id || ev.empleado;
            const b = ev.empleado_destino_id || ev.empleado_b_id || ev.destino_id || ev.sustituto_id || ev.empleado_destino;
            if (a) extraEmpIds.add(window.normalizeId(a));
            if (b) extraEmpIds.add(window.normalizeId(b));
        });

        extraEmpIds.forEach(empId => {
            if (renderedNorms.has(empId)) return;
            
            const profile = employees.find(e => window.normalizeId(e.id) === empId || window.normalizeId(e.nombre) === empId);
            const res = window.resolveEmployeeDay({
                empleado: profile,
                empleadoId: empId,
                hotel,
                fecha: date,
                turnoBase: null,
                eventos: events,
                baseIndex
            });

            // Solo añadir si es relevante para este hotel
            if (res.hotel === window.normalizeId(hotel) || res.sustituyeA || res.sustituidoPor) {
                const cell = adaptResultToCell(res);
                entries.push({
                    norm: empId,
                    id: empId,
                    name: profile?.nombre || empId,
                    displayAs: profile?.nombre || empId,
                    profile,
                    sourceOrder: 9999,
                    isAbsent: !!res.incidencia,
                    cell,
                    showStats: employeeComputesForStats(profile),
                    substituting: res.sustituyeA,
                    substitutedBy: res.sustituidoPor,
                    _finalState: res
                });
                renderedNorms.add(empId);
            }
        });

        return entries;
    };

    const buildRosterGrid = ({
        rows = [],
        events = [],
        employees = [],
        dates = [],
        hotel,
        sourceRows = []
    } = {}) => {
        // Construir índices una sola vez
        // Para baseRows necesitamos aplanar sourceRows con sus fechas
        const baseRowsFlat = [];
        sourceRows.forEach(sRow => {
            dates.forEach((date, idx) => {
                baseRowsFlat.push({
                    empleadoId: sRow.empleadoId,
                    fecha: date,
                    turno: sRow.values[idx] || null
                });
            });
        });

        const { baseIndex } = window.buildIndices(employees, events, baseRowsFlat);

        const dayRosters = dates.map((date, idx) => buildDayRoster({
            date,
            hotel,
            employees,
            events,
            sourceRows,
            sourceIndex: idx,
            baseIndex
        }));

        // Merge logic (simplificada)
        const entriesByNorm = new Map();
        dayRosters.forEach((dr, dayIdx) => {
            dr.forEach(entry => {
                if (!entriesByNorm.has(entry.norm)) {
                    entriesByNorm.set(entry.norm, { ...entry, cells: new Array(dates.length).fill(null) });
                }
                entriesByNorm.get(entry.norm).cells[dayIdx] = entry.cell;
            });
        });

        // Rellenar huecos en cells
        entriesByNorm.forEach(entry => {
            entry.cells = entry.cells.map((c, idx) => c || {
                empleado_id: entry.id,
                fecha: dates[idx],
                turno: '',
                tipo: 'NORMAL'
            });
        });

        const entries = Array.from(entriesByNorm.values()).sort((a, b) => a.sourceOrder - b.sourceOrder);
        
        // Separar ausentes al final si la regla sigue activa
        const main = entries.filter(e => !e.isAbsent);
        const absents = entries.filter(e => e.isAbsent);

        return { entries: [...main, ...absents], dates, dayRosters };
    };

    window.TurnosEngine = {
        buildRosterGrid,
        buildDayRoster,
        adaptResultToCell,
        employeeTypeKey,
        employeeComputesForStats
    };
})();
