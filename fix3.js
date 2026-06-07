const fs = require('fs');
let admin = fs.readFileSync('admin.js', 'utf8');

const targetStr = `                const hotelExcelRows = excelSource[hName] || [];
                const weekSeed = hotelExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));
                if (!weekSeed) return;
                const weekStartIso = weekSeed.weekStart;
                const fechasSemana = window.getFechasSemana(weekStartIso);
                const sourceIndex = Math.max(0, fechasSemana.indexOf(date));
                const weekExcelRows = hotelExcelRows.filter(r => r.weekStart === weekStartIso);`;

const replacementStr = `                const hotelExcelRows = excelSource[hName] || [];
                const ambosExcelRows = excelSource['Ambos hoteles'] || [];
                const combinedExcelRows = [...hotelExcelRows, ...ambosExcelRows];
                const weekSeed = combinedExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));
                if (!weekSeed) return;
                const weekStartIso = weekSeed.weekStart;
                const fechasSemana = window.getFechasSemana(weekStartIso);
                const sourceIndex = Math.max(0, fechasSemana.indexOf(date));
                const weekExcelRows = combinedExcelRows.filter(r => r.weekStart === weekStartIso);`;

admin = admin.replace(targetStr, replacementStr);

const targetDoubleCount = `                dayRoster.forEach(entry => {
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (!s) return;
                    const cell = entry.cell || {};
                    let label = cell.turno || '';`;

const replacementDoubleCount = `                dayRoster.forEach(entry => {
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (!s) return;
                    if (s.history.some(h => h.fecha === date)) return; // Prevent double count
                    const cell = entry.cell || {};
                    let label = cell.turno || '';`;

admin = admin.replace(targetDoubleCount, replacementDoubleCount);
fs.writeFileSync('admin.js', admin);
console.log('Fixed admin.js double count 2');
