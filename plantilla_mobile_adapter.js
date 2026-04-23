/* plantilla_mobile_adapter.js
   Adaptador para versión móvil:
   - Utiliza window.TurnosEngine como motor de renderizado pasivo.
   - Garantiza paridad total con index.html y admin.js.
   - Respeta estrictamente el orden de filas definido en el Excel original.
   - Aplica ausencias (Vacaciones, Baja) sobre la estructura fija del Excel.
   - El campo 'sustituto' se ignora completamente según las reglas globales.
*/
window.MobileAdapter = (function () {
    const pad = n => String(n).padStart(2, "0");

    function mondayUTC(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const day = d.getUTCDay();
        const diff = (day === 0 ? -6 : 1 - day);
        d.setUTCDate(d.getUTCDate() + diff);
        return d;
    }

    function addDays(d, n) {
        const x = new Date(d.getTime());
        x.setUTCDate(x.getUTCDate() + n);
        return x;
    }

    function isoFromUTCDate(d) {
        return [
            d.getUTCFullYear(),
            pad(d.getUTCMonth() + 1),
            pad(d.getUTCDate())
        ].join("-");
    }

    function buildWeekData(FULL_DATA, hotel, monday, profiles = []) {
        const mondayUTCDate = mondayUTC(monday);
        const mondayISO = isoFromUTCDate(mondayUTCDate);
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            weekDays.push(isoFromUTCDate(addDays(mondayUTCDate, i)));
        }

        const rows = FULL_DATA?.rows || FULL_DATA?.flat || [];
        const events = FULL_DATA?.eventos || [];
        const excelSource = FULL_DATA?.excelSource || {};
        const sourceRowsForHotel = excelSource[hotel] || [];
        const currentWeekExcelRows = sourceRowsForHotel.filter(r => r.weekStart === mondayISO);

        const rosterGrid = window.TurnosEngine.buildRosterGrid({
            rows,
            events,
            employees: profiles,
            dates: weekDays,
            hotel,
            sourceRows: currentWeekExcelRows
        });

        const empDetailed = rosterGrid.entries.map(entry => ({
            id: entry.name,
            norm: entry.norm,
            isAbsent: entry.isAbsent
        }));

        const turnosByEmpleado = {};
        rosterGrid.entries.forEach(entry => {
            turnosByEmpleado[entry.name] = {};
            entry.cells.forEach((cell, idx) => {
                turnosByEmpleado[entry.name][weekDays[idx]] = cell;
            });
        });

        return {
            monday: mondayUTCDate,
            empleados: empDetailed.map(e => e.id),
            empDetailed,
            turnosByEmpleado
        };
    }

    return { buildWeekData };
})();
