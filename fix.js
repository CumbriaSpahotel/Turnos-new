const fs = require('fs');
let admin = fs.readFileSync('admin.js', 'utf8');

const targetStr = `        hotelsList.forEach(hName => {
            dates.forEach(date => {
                const hotelExcelRows = excelSource[hName] || [];
                const weekSeed = hotelExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));`;

const replacementStr = `        hotelsList.forEach(hName => {
            dates.forEach(date => {
                const hotelExcelRows = excelSource[hName] || [];
                const ambosExcelRows = excelSource['Ambos hoteles'] || [];
                const combinedExcelRows = [...hotelExcelRows, ...ambosExcelRows];
                const weekSeed = combinedExcelRows.find(r => window.getFechasSemana(r?.weekStart).includes(date));`;

admin = admin.replace(targetStr, replacementStr);

const targetStr2 = `                const weekExcelRows = hotelExcelRows.filter(r => r.weekStart === weekStartIso);`;
const replacementStr2 = `                const weekExcelRows = combinedExcelRows.filter(r => r.weekStart === weekStartIso);`;

// Only replace the ones in the second populateEmployees by starting the search after the first occurrence
let idx = admin.indexOf('window.populateEmployees = async () => {', 4900); // 4900 is past the first one
if (idx !== -1) {
    let secondBlock = admin.substring(idx);
    secondBlock = secondBlock.replace(targetStr, replacementStr);
    secondBlock = secondBlock.replace(targetStr2, replacementStr2);
    
    // Add double counting prevention
    const targetStr3 = `                dayRoster.forEach(entry => {
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (!s) return;
                    const cell = entry.cell || {};`;
    const replacementStr3 = `                dayRoster.forEach(entry => {
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (!s) return;
                    if (s.history.some(h => h.fecha === date)) return; // Prevent double count for Ambos hoteles
                    const cell = entry.cell || {};`;
    secondBlock = secondBlock.replace(targetStr3, replacementStr3);
    
    admin = admin.substring(0, idx) + secondBlock;
}

fs.writeFileSync('admin.js', admin);
console.log('Fixed admin.js');
