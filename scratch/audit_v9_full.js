const XLSX = require('xlsx');
const fs = require('fs');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function fetchAll(endpoint) {
    let allData = [];
    let limit = 1000;
    let offset = 0;
    while (true) {
        const res = await fetch(`${SUPABASE_URL}/${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}&offset=${offset}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await res.json();
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < limit) break;
        offset += limit;
    }
    return allData;
}

const normalizeText = (text) => {
    if (!text) return '';
    return String(text).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ' ').trim();
};

function normalizeTurno(t) {
    if (!t) return '-';
    const nt = String(t).toUpperCase().trim();
    if (nt === 'M' || nt === 'T' || nt === 'N' || nt === 'D' || nt === '-') return nt;
    if (nt === '—') return '-';
    if (nt.startsWith('M')) return 'M';
    if (nt.startsWith('T')) return 'T';
    if (nt.startsWith('N')) return 'N';
    if (nt.startsWith('D')) return 'D';
    return nt; // Return raw to flag as illegal if not M/T/N/D/-
}

async function runAudit() {
    console.log("Loading Supabase data...");
    const dbTurnos = await fetchAll("turnos?select=*");
    const dbEmpleados = await fetchAll("empleados?select=*");

    console.log(`Loaded ${dbTurnos.length} turnos and ${dbEmpleados.length} empleados from DB.`);

    const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
    if (!fs.existsSync(filePath)) {
        console.error("Excel not found:", filePath);
        return;
    }

    const workbook = XLSX.readFile(filePath, { cellDates: true });
    
    const excelData = [];
    const weeksOrder = {}; // hotel -> week -> [{ empName, rowIndex }]
    
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
            const match = part.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
            if (match) return `20${match[3]}-${match[2]}-${match[1]}`;
        }
        return null;
    };

    const addDays = (dateStr, days) => {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    workbook.SheetNames.forEach(sheetName => {
        if (!['Cumbria Spa&Hotel', 'Sercotel Guadiana'].includes(sheetName)) return; // Focus on valid sheets
        
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
        
        let currentWeek = null;
        rows.forEach((row, rowIndex) => {
            if (!row || row.length === 0) return;
            const maybeDate = excelCellDate(row[0]);
            
            if (maybeDate) {
                currentWeek = maybeDate;
                if (!weeksOrder[sheetName]) weeksOrder[sheetName] = {};
                if (!weeksOrder[sheetName][currentWeek]) weeksOrder[sheetName][currentWeek] = [];
            }
            
            const empName = String(row[1] || '').trim();
            if (currentWeek && empName && empName.toLowerCase() !== 'empleado' && empName.length > 1) {
                
                weeksOrder[sheetName][currentWeek].push({ empName, rowIndex });

                for (let i = 0; i < 7; i++) {
                    const date = addDays(currentWeek, i);
                    const turnoRaw = String(row[i + 2] || '').trim();
                    const turnoNorm = normalizeTurno(turnoRaw);
                    
                    excelData.push({
                        hotel: sheetName,
                        week_start: currentWeek,
                        excel_row_index: rowIndex,
                        empleado_nombre_excel: empName,
                        fecha: date,
                        turno_esperado: turnoNorm,
                        turno_literal: turnoRaw
                    });
                }
            }
        });
    });

    console.log(`Extracted ${excelData.length} turnos from Excel.`);

    // --- IDENTIFICATION RESOLUTION ---
    const resolveIdentity = (empName) => {
        const normSearch = normalizeText(empName);
        if (!normSearch) return null;
        
        const exactMatch = dbEmpleados.find(e => normalizeText(e.nombre) === normSearch || normalizeText(e.id_interno) === normSearch);
        if (exactMatch) return exactMatch;
        
        const partialMatches = dbEmpleados.filter(e => normalizeText(e.nombre).includes(normSearch) || normSearch.includes(normalizeText(e.nombre)));
        if (partialMatches.length === 1) return partialMatches[0];
        
        // Return multiple if ambiguous
        if (partialMatches.length > 1) return { ambiguous: true, matches: partialMatches };
        
        return null;
    };

    let faltantes = [];
    let sobrantes = [];
    let distintos = [];
    let duplicados = [];
    let ambiguos = new Set();
    let ilegales = new Set();
    let hotelMismatch = [];
    let orderMismatch = [];

    let dbMatchedIds = new Set();

    // Map DB turnos for quick lookup
    const dbMap = {};
    dbTurnos.forEach(t => {
        const key = `${t.fecha}_${t.empleado_id}`;
        if (!dbMap[key]) dbMap[key] = [];
        dbMap[key].push(t);
        
        const tn = normalizeTurno(t.turno);
        if (!['M', 'T', 'N', 'D', '-'].includes(tn)) {
            ilegales.add(t.turno);
        }
    });

    for (const [key, arr] of Object.entries(dbMap)) {
        if (arr.length > 1) {
            const uniqueTurnos = new Set(arr.map(a => normalizeTurno(a.turno)));
            if (uniqueTurnos.size > 1 || arr.length > 1) {
                duplicados.push({ key, count: arr.length, turnos: arr.map(a => a.turno) });
            }
        }
    }

    excelData.forEach(ex => {
        const resolved = resolveIdentity(ex.empleado_nombre_excel);
        if (!resolved) {
            ambiguos.add(`No found: ${ex.empleado_nombre_excel}`);
            return;
        }
        if (resolved.ambiguous) {
            ambiguos.add(`Ambiguous: ${ex.empleado_nombre_excel} -> ${resolved.matches.map(m=>m.nombre).join(', ')}`);
            return;
        }

        const empId = resolved.id;
        const key = `${ex.fecha}_${empId}`;
        const dbRecords = dbMap[key] || [];

        if (dbRecords.length === 0) {
            if (ex.turno_esperado !== '-') {
                faltantes.push({ ex, resolved });
            }
        } else {
            dbRecords.forEach(db => {
                dbMatchedIds.add(db.id);
                if (db.hotel_id !== ex.hotel) {
                    hotelMismatch.push({ ex, db });
                }
                const dbTurnoNorm = normalizeTurno(db.turno);
                if (dbTurnoNorm !== ex.turno_esperado) {
                    // Ignore exact matches or if both are empty
                    if (ex.turno_esperado === '-' && (dbTurnoNorm === '-' || !dbTurnoNorm)) return;
                    distintos.push({ ex, db, expected: ex.turno_esperado, got: db.turno });
                }
            });
        }
    });

    // Sobrantes
    dbTurnos.forEach(db => {
        if (!dbMatchedIds.has(db.id)) {
            // It might be from another date range or hotel
            const date = db.fecha;
            const hotel = db.hotel_id;
            // Only consider it sobrante if it falls within the weeks we extracted for that hotel
            let withinExtractedRange = false;
            if (weeksOrder[hotel]) {
                const dates = Object.keys(weeksOrder[hotel]);
                const minDate = dates.sort()[0];
                const maxDate = addDays(dates.sort()[dates.length - 1], 6);
                if (date >= minDate && date <= maxDate) {
                    withinExtractedRange = true;
                }
            }
            if (withinExtractedRange && normalizeTurno(db.turno) !== '-') {
                sobrantes.push(db);
            }
        }
    });

    console.log("\n=== REPORTE DE AUDITORÍA ===");
    console.log(`Total celdas/turnos esperados desde Excel: ${excelData.length}`);
    console.log(`Total registros DB comparados: ${dbTurnos.length}`);
    console.log(`Total faltantes: ${faltantes.length}`);
    console.log(`Total sobrantes: ${sobrantes.length}`);
    console.log(`Total distintos: ${distintos.length}`);
    console.log(`Total duplicados: ${duplicados.length}`);
    console.log(`Códigos ilegales en DB: ${[...ilegales].join(', ')}`);
    console.log(`Identidades ambiguas o no encontradas: ${ambiguos.size}`);
    
    console.log("\n--- Identidades Problemáticas ---");
    [...ambiguos].slice(0, 10).forEach(a => console.log(a));

    console.log("\n--- Ejemplos Faltantes (Top 5) ---");
    faltantes.slice(0, 5).forEach(f => console.log(`${f.ex.fecha} | ${f.ex.empleado_nombre_excel} (${f.resolved.nombre}) | Esperado: ${f.ex.turno_esperado}`));

    console.log("\n--- Ejemplos Distintos (Top 10) ---");
    distintos.slice(0, 10).forEach(d => console.log(`${d.ex.fecha} | ${d.ex.empleado_nombre_excel} | Esperado: ${d.expected} | DB: ${d.got} | ID: ${d.db.id}`));

    console.log("\n--- Ejemplos Sobrantes (Top 5) ---");
    sobrantes.slice(0, 5).forEach(s => console.log(`${s.fecha} | Hotel: ${s.hotel_id} | Emp ID: ${s.empleado_id} | Turno: ${s.turno}`));

    console.log("\n--- Duplicados ---");
    duplicados.slice(0, 5).forEach(d => console.log(d));

    console.log("\n--- Sergio vs Sergio Sánchez ---");
    const sergios = dbEmpleados.filter(e => e.nombre.toLowerCase().includes('sergio'));
    sergios.forEach(s => console.log(`DB Emp: ${s.nombre} -> ID: ${s.id}`));
    console.log(`Matches ambiguos con Sergio: ${[...ambiguos].filter(a => a.toLowerCase().includes('sergio')).length}`);

    console.log("\n--- Natalio vs Natalia ---");
    const nat = dbEmpleados.filter(e => e.nombre.toLowerCase().includes('natal'));
    nat.forEach(n => console.log(`DB Emp: ${n.nombre} -> ID: ${n.id}`));
}

runAudit();
