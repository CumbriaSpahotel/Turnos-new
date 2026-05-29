const fs = require('fs');
global.window = {};

const loaderText = fs.readFileSync('excel-loader.js', 'utf8');
eval(loaderText);

console.log("Before override:", global.window.ExcelLoader.loadExcelSourceRows.toString());

global.window.ExcelLoader.loadExcelSourceRows = async () => {
  console.log("Override called!");
};

console.log("After override:", global.window.ExcelLoader.loadExcelSourceRows.toString());

global.window.ExcelLoader.loadExcelSourceRows();
