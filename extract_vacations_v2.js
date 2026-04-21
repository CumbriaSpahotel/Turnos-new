const fs = require('fs');
const vm = require('vm');

const xlsxPath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\xlsx.full.min.js';
const xlsxData = fs.readFileSync(xlsxPath, 'utf8');

const sandbox = { 
    exports: {},
    module: { exports: {} },
    process: process,
    Buffer: Buffer,
    Uint8Array: Uint8Array,
    Int32Array: Int32Array,
    Float64Array: Float64Array
};
vm.createContext(sandbox);
vm.runInContext(xlsxData, sandbox);

// XLSX attaches to 'sandbox' or its module.exports/exports
const XLSX = sandbox.XLSX || sandbox.module.exports || sandbox.exports;

if (!XLSX || typeof XLSX.read !== 'function') {
    // Some versions might be even more annoying
    console.error('XLSX not found or XLSX.read is not a function');
    process.exit(1);
}

const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\Plantilla Cuadrante con Sustituciones v.6.0.xlsx';
const buf = fs.readFileSync(filePath);
const workbook = XLSX.read(buf, { type: 'buffer' });

const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('vac') || s.toLowerCase().includes('ausencia'));
if (sheetName) {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    console.log(JSON.stringify(data));
} else {
    console.log('No vacation sheet found');
}
