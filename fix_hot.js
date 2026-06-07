const fs = require('fs');
let admin = fs.readFileSync('admin.js', 'utf8');

const t1 = `        // Iterar el motor por cada hotel y cada día para extraer el Roster final operativo
        hotelsList.forEach(hName => {
            dates.forEach(date => {
                const hotelExcelRows = excelSource[hName] || [];
                const ambosExcelRows = excelSource['Ambos hoteles'] || [];
                const combinedExcelRows = [...hotelExcelRows, ...ambosExcelRows];
                const weekSeed = combinedExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));
                if (!weekSeed) return;

                // Lunes correspondiente a este día
                const weekStartIso = weekSeed.weekStart;
                const fechasSemana = window.getFechasSemana(weekStartIso);
                const sourceIndex = Math.max(0, fechasSemana.indexOf(date));

                const weekExcelRows = combinedExcelRows.filter(r => r.weekStart === weekStartIso);
                if (weekExcelRows.length === 0) return; // Si no hay excel para esa semana, saltamos`;

const r1 = `        // Iterar el motor por cada hotel y cada día para extraer el Roster final operativo
        const allHotels = [...hotelsList, 'Ambos hoteles'];
        allHotels.forEach(hName => {
            dates.forEach(date => {
                const hotelExcelRows = excelSource[hName] || [];
                const weekSeed = hotelExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));
                if (!weekSeed) return;

                // Lunes correspondiente a este día
                const weekStartIso = weekSeed.weekStart;
                const fechasSemana = window.getFechasSemana(weekStartIso);
                const sourceIndex = Math.max(0, fechasSemana.indexOf(date));

                const weekExcelRows = hotelExcelRows.filter(r => r.weekStart === weekStartIso);
                if (weekExcelRows.length === 0) return; // Si no hay excel para esa semana, saltamos`;

admin = admin.replace(t1, r1);

const t2 = `        hotelsList.forEach(hName => {
            dates.forEach(date => {
                const hotelExcelRows = excelSource[hName] || [];
                const ambosExcelRows = excelSource['Ambos hoteles'] || [];
                const combinedExcelRows = [...hotelExcelRows, ...ambosExcelRows];
                const weekSeed = combinedExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));
                if (!weekSeed) return;
                const weekStartIso = weekSeed.weekStart;
                const fechasSemana = window.getFechasSemana(weekStartIso);
                const sourceIndex = Math.max(0, fechasSemana.indexOf(date));
                const weekExcelRows = combinedExcelRows.filter(r => r.weekStart === weekStartIso);
                if (!weekExcelRows.length) return;
                const dayRoster = window.TurnosEngine.buildDayRoster({ rows, events: eventos, employees: profilesResult, date, hotel: hName, sourceRows: weekExcelRows, sourceIndex });
                dayRoster.forEach(entry => {
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (!s) return;
                    const cell = entry.cell || {};`;

const r2 = `        const allHotels = [...hotelsList, 'Ambos hoteles'];
        allHotels.forEach(hName => {
            dates.forEach(date => {
                const hotelExcelRows = excelSource[hName] || [];
                const weekSeed = hotelExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));
                if (!weekSeed) return;
                const weekStartIso = weekSeed.weekStart;
                const fechasSemana = window.getFechasSemana(weekStartIso);
                const sourceIndex = Math.max(0, fechasSemana.indexOf(date));
                const weekExcelRows = hotelExcelRows.filter(r => r.weekStart === weekStartIso);
                if (!weekExcelRows.length) return;
                const dayRoster = window.TurnosEngine.buildDayRoster({ rows, events: eventos, employees: profilesResult, date, hotel: hName, sourceRows: weekExcelRows, sourceIndex });
                dayRoster.forEach(entry => {
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (!s) return;
                    if (s.history.some(h => h.fecha === date)) return; // Prevent double count
                    const cell = entry.cell || {};`;

admin = admin.replace(t2, r2);

fs.writeFileSync('admin.js', admin);
console.log('Fixed populateEmployees hotels array!');
