const fs = require('fs');
const path = require('path');

// Cargar el script de xlsx como una cadena y evaluarlo en el contexto de node
// Nota: xlsx.full.min.js suele exponer una variable global 'XLSX'
const xlsxPath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\xlsx.full.min.js';
const xlsxContent = fs.readFileSync(xlsxPath, 'utf8');

// Simulamos un entorno de navegador para que xlsx se inicialice
const vm = require('vm');
const context = { 
    module: { exports: {} },
    exports: {},
    require: require,
    console: console,
    process: process,
    Buffer: Buffer
};
vm.createContext(context);
vm.runInContext(xlsxContent, context);

const XLSX = context.XLSX;

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\Plantilla Cuadrante con Sustituciones v.6.0.xlsx';
const buf = fs.readFileSync(filePath);
const workbook = XLSX.read(buf, { type: 'buffer' });

console.log('Hojas disponibles:', workbook.SheetNames.join(' | '));

const vacSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('vac') || s.toLowerCase().includes('ausencia'));
if (vacSheetName) {
    const sheet = workbook.Sheets[vacSheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`\nExtraídos ${data.length} registros de la hoja: ${vacSheetName}\n`);
    
    // Imprimir los primeros 50 registros para identificar columnas
    data.slice(0, 100).forEach((row, i) => {
        console.log(`${i}: ${JSON.stringify(row)}`);
    });
} else {
    console.log('No se encontró hoja de vacaciones.');
}
