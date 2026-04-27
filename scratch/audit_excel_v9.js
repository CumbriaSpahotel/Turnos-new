const XLSX = require('xlsx');
const fs = require('fs');

async function auditExcel() {
    console.log("=== 3. AUDITAR EXCEL ORIGINAL DIRECTAMENTE ===");
    const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
    if (!fs.existsSync(filePath)) {
        console.error("Archivo no encontrado:", filePath);
        return;
    }
    
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = 'Cumbria Spa&Hotel';
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
        console.error("Hoja no encontrada:", sheetName);
        return;
    }
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    
    const weeksToCheck = ['2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20'];
    
    const excelCellDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) {
            if (isNaN(value.getTime())) return null;
            return value.toISOString().split('T')[0];
        }
        if (typeof value === 'number') {
            const ms = Math.round((value - 25569) * 86400 * 1000);
            return new Date(ms).toISOString().split('T')[0];
        }
        if (typeof value === 'string') {
            const part = value.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
            // format dd/mm/yy
            const match = part.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
            if (match) return `20${match[3]}-${match[2]}-${match[1]}`;
        }
        return null;
    };
    
    console.log("Filas literales del Excel:");
    data.slice(1).forEach((row, i) => {
        const d = excelCellDate(row[0]);
        if (weeksToCheck.includes(d)) {
            console.log(`[${d}] Emp: "${row[1]}" | L:${row[2]} M:${row[3]} X:${row[4]} J:${row[5]} V:${row[6]} S:${row[7]} D:${row[8]}`);
        }
    });

    console.log("\n=== 4/7/8. COMPARAR EXCEL VS SUPABASE ===");
    const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1";
    const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

    const response = await fetch(`${SUPABASE_URL}/turnos?hotel_id=eq.Cumbria%20Spa%26Hotel&fecha=gte.2026-03-30&fecha=lte.2026-04-26&select=fecha,empleado_id,turno`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    
    const dbTurnos = await response.json();
    
    // Check duplicates
    const countMap = {};
    dbTurnos.forEach(t => {
        const key = `${t.fecha}_${t.empleado_id}`;
        if (!countMap[key]) countMap[key] = { count: 0, turnos: [] };
        countMap[key].count++;
        countMap[key].turnos.push(t.turno);
    });
    
    console.log("\nDuplicados encontrados en DB:");
    let hasDups = false;
    for (const [key, val] of Object.entries(countMap)) {
        if (val.count > 1) {
            console.log(`${key}: ${val.count} veces -> ${JSON.stringify(val.turnos)}`);
            hasDups = true;
        }
    }
    if (!hasDups) console.log("Ninguno.");
    
    // Check Valentín (06/04/26) in DB
    console.log("\nValentín en semana 06/04/26 DB:");
    const valDB = dbTurnos.filter(t => t.empleado_id.toLowerCase().includes('valent') && t.fecha >= '2026-04-06' && t.fecha <= '2026-04-12');
    console.log(valDB.map(t => `${t.fecha} | "${t.empleado_id}" | ${t.turno}`).join('\n'));

    // Check Miriam CT
    console.log("\nMiriam semana 13/04/26 DB:");
    const miriamDB = dbTurnos.filter(t => t.empleado_id.toLowerCase().includes('miriam') && t.fecha >= '2026-04-13' && t.fecha <= '2026-04-19');
    console.log(miriamDB.map(t => `${t.fecha} | "${t.empleado_id}" | ${t.turno}`).join('\n'));

    // Check invalid base turnos globally
    console.log("\nCódigos en tabla turnos:");
    const responseAll = await fetch(`${SUPABASE_URL}/turnos?select=turno`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    const allTurnos = await responseAll.json();
    const tCount = {};
    allTurnos.forEach(t => {
        const val = t.turno || 'NULL';
        tCount[val] = (tCount[val] || 0) + 1;
    });
    for (const [k, v] of Object.entries(tCount)) {
        console.log(`Turno: "${k}" -> ${v}`);
    }
}

auditExcel();
