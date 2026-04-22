(function () {
    const normalizeString = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const normalizeHotelKey = (value) => normalizeString(value);

    const employeeTypeKey = (value) => normalizeString(value || 'fijo').replace(/\s+/g, '_');

    const isAbsence = (row) => window.TurnosRules.isAbsenceType(row?.tipo);

    const profileMap = (employees = []) => {
        const map = new Map();
        employees.forEach(profile => {
            [profile?.id, profile?.nombre].forEach(value => {
                const key = normalizeString(value);
                if (key && !map.has(key)) map.set(key, profile);
            });
        });
        return map;
    };

    const profileFor = (profilesByNorm, norm) => profilesByNorm.get(norm) || null;

    const employeeComputesForStats = (profile) => {
        const key = employeeTypeKey(profile?.tipo_personal || profile?.contrato);
        return key !== 'ocasional' && key !== 'eventual' && key !== 'apoyo' && key !== 'apollo';
    };

    const sourceRowsMap = (sourceRows = []) => {
        const map = new Map();
        sourceRows.forEach((row, index) => {
            const norm = normalizeString(row.empleadoId || row.id || row.nombre);
            if (!norm || map.has(norm)) return;
            map.set(norm, { ...row, _sourceIndex: row.rowIndex ?? index });
        });
        return map;
    };

    const buildDayRoster = ({
        rows = [],
        employees = [],
        date,
        hotel,
        sourceRows = [],
        sourceIndex = 0
    } = {}) => {
        const profilesByNorm = profileMap(employees);
        
        // 1. Get absences for this date
        const dayAbsences = new Map();
        rows.filter(r => r?.fecha === date && isAbsence(r)).forEach(r => {
            dayAbsences.set(normalizeString(r.empleado_id), r);
        });

        // 2. Map Excel rows to roster entries (Maintain Excel Order)
        return sourceRows.map(sRow => {
            const norm = normalizeString(sRow.empleadoId);
            const absence = dayAbsences.get(norm);
            const excelShift = sRow.values[sourceIndex];
            const profile = profileFor(profilesByNorm, norm);

            return {
                norm,
                id: sRow.empleadoId,
                name: sRow.displayName || sRow.empleadoId,
                displayAs: sRow.displayName || sRow.empleadoId,
                profile,
                sourceOrder: sRow.rowIndex,
                isAbsent: !!absence,
                cell: absence || {
                    empleado_id: sRow.empleadoId,
                    fecha: date,
                    turno: excelShift,
                    tipo: 'NORMAL',
                    hotel_id: hotel
                },
                showStats: employeeComputesForStats(profile)
            };
        });
    };

    const mergeDayRosters = ({ dayRosters = [], dates = [], hotel } = {}) => {
        if (!dayRosters.length) return { entries: [], dates };

        // Since all dayRosters are based on the same sourceRows (for a given week/hotel),
        // we can just take the first one to define the entries list.
        const entries = dayRosters[0].map((baseEntry, entryIdx) => {
            const cells = dayRosters.map(dr => dr[entryIdx].cell);
            return {
                ...baseEntry,
                cells
            };
        });

        return { entries, dates, dayRosters };
    };

    const buildRosterGrid = ({
        rows = [],
        employees = [],
        dates = [],
        hotel,
        sourceRows = []
    } = {}) => {
        const dayRosters = dates.map((date, idx) => buildDayRoster({
            rows,
            employees,
            date,
            hotel,
            sourceRows,
            sourceIndex: idx
        }));
        return mergeDayRosters({ dayRosters, dates, hotel });
    };

    window.TurnosEngine = {
        buildDayRoster,
        buildRosterGrid,
        mergeDayRosters,
        normalizeString,
        normalizeHotelKey,
        employeeTypeKey,
        employeeComputesForStats
    };
})();
