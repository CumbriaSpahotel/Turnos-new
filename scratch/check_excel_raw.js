const fs = require('fs');
const XLSX = require('../xlsx.full.min.js');

async function run() {
    const wb = XLSX.readFile('c:/Users/comun/Documents/GitHub/Turnos-new/V.9-Turnos.xlsx');
    const ws = wb.Sheets['Cumbria Spa&Hotel'];
    if (ws) {
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
        console.log('Cumbria Rows:', json.length);
        if (json.length > 5) {
            console.log('Headers (Row 5):', json[4].slice(0, 15));
            console.log('Row 6:', json[5].slice(0, 15));
            console.log('Row 7:', json[6].slice(0, 15));
            console.log('Row -3:', json[json.length - 3].slice(0, 15));
            console.log('Row -2:', json[json.length - 2].slice(0, 15));
            console.log('Row -1:', json[json.length - 1].slice(0, 15));
        }
    }
}
run().catch(console.error);
