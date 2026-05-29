const fs = require('fs');
// Load the minified xlsx library
const XLSX = require('../xlsx.full.min.js');

function checkExcel() {
  console.log("Reading V.9-Turnos.xlsx...");
  const buf = fs.readFileSync('V.9-Turnos.xlsx');
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
  
  const sheets = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.log(`Sheet not found: ${sheetName}`);
      continue;
    }
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    console.log(`\nSheet: ${sheetName}, total rows: ${matrix.length}`);
    
    // Find rows matching 'Natalio' or similar
    const headerRow = matrix[0];
    const rows = matrix.slice(1);
    const natalioRows = rows.filter(row => {
      const name = String(row[1] || '').trim();
      return name.toLowerCase().includes('natalio') || name.toLowerCase().includes('natalia');
    });
    
    console.log(`Found ${natalioRows.length} rows for Natalio/Natalia:`);
    for (const r of natalioRows) {
      console.log(`- Date (Col 0): ${r[0]}, Name: ${r[1]}, Turnos: ${r.slice(2, 9).join(', ')}`);
    }
  }
}

checkExcel();
