const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/events_dump.json', 'utf8'));

const dianaPerm = data.diana.filter(e => e.estado !== 'anulado' && e.tipo.includes('PERM'));
const sergioPerm = data.sergio.filter(e => e.estado !== 'anulado' && e.tipo.includes('PERM'));
const ctDaniMacarena = data.ct.filter(e => e.estado !== 'anulado' && e.tipo.includes('INTERCAMBIO'));

console.log("Diana Permisos:", dianaPerm.map(e => e.fecha_inicio));
console.log("Sergio Permisos:", sergioPerm.map(e => e.fecha_inicio));
console.log("CT Dani/Macarena:", ctDaniMacarena.map(e => e.fecha_inicio));
