const fs = require('fs');
let admin = fs.readFileSync('admin.js', 'utf8');

const targetStr = `                dayRoster.forEach(entry => {
                    const cell = entry.cell || {};
                    // entry.displayAs trae el nombre normalizado pero visualmente correcto
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    
                    let label = cell.turno || 'ï¿½ ';`;

const replacementStr = `                dayRoster.forEach(entry => {
                    const cell = entry.cell || {};
                    // entry.displayAs trae el nombre normalizado pero visualmente correcto
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (s && s.history.some(h => h.fecha === date)) return; // Prevent double count
                    
                    let label = cell.turno || '—';`;

admin = admin.replace(targetStr, replacementStr);
fs.writeFileSync('admin.js', admin);
console.log('Fixed admin.js double count 1');
