const XLSX = require('./temp_node/node_modules/xlsx');
const fs = require('fs');

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\Plantilla Cuadrante con Sustituciones v.6.0.xlsx';
const workbook = XLSX.readFile(filePath);

console.log('Sheets found:', workbook.SheetNames);
