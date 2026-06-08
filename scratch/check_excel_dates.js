const fs = require('fs');
const path = require('path');
global.window = {};
global.document = { querySelectorAll: () => [] };
global.fetch = async (url) => {
    if (typeof url==='string' && url.includes('V.9-Turnos.xlsx')) {
        const buffer = fs.readFileSync(path.resolve('c:/Users/comun/Documents/GitHub/Turnos-new', url));
        return { ok: true, arrayBuffer: async () => buffer };
    }
    return null;
};
global.XLSX = require('xlsx');

// mock normalizeId
global.window.normalizeId = (val) => String(val||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
global.window.isoDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth()+1).padStart(2,'0');
        const d = String(value.getDate()).padStart(2,'0');
        return `${y}-${m}-${d}`;
    }
    return String(value).slice(0,10);
};

require('c:/Users/comun/Documents/GitHub/Turnos-new/excel-loader.js');

async function run() {
    const excelSource = await global.window.ExcelLoader.loadExcelSourceRows();
    const rows = excelSource['Cumbria Spa&Hotel'] || [];
    console.log('Cumbria Excel Rows:', rows.length);
    const withShifts = rows.filter(r => r.values && r.values.some(v => v && v !== '—'));
    console.log('Rows with shifts:', withShifts.length);
    if (withShifts.length > 0) {
        console.log('Sample row with shift:', withShifts[0].displayName, withShifts[0].weekStart, withShifts[0].values);
    }
    
    // Check if we have anything for 2026-06-08 week
    const targetDate = '2026-06-08';
    global.window.getFechasSemana = (lunesIso) => {
        const d = new Date(lunesIso+'T12:00:00');
        return Array.from({length:7}, (_, i) => {
            const nd = new Date(d);
            nd.setDate(nd.getDate() + i);
            return global.window.isoDate(nd);
        });
    };
    
    const weekSeed = rows.find(r => global.window.getFechasSemana(r?.weekStart).includes(targetDate));
    if (weekSeed) {
        console.log('Week found for 2026-06-08:', weekSeed.weekStart);
        const thisWeek = rows.filter(r => r.weekStart === weekSeed.weekStart);
        console.log('Rows for this week:', thisWeek.length);
        const thisWeekWithShifts = thisWeek.filter(r => r.values && r.values.some(v => v && v !== '—'));
        console.log('Rows with shifts this week:', thisWeekWithShifts.length);
        if (thisWeekWithShifts.length > 0) {
            console.log('Sample from this week:', thisWeekWithShifts[0].displayName, thisWeekWithShifts[0].values);
        }
    } else {
        console.log('NO WEEK FOUND FOR 2026-06-08 in Cumbria rows!');
        // what is the latest week we have?
        const sorted = rows.map(r => r.weekStart).filter(Boolean).sort().reverse();
        console.log('Latest weeks available:', [...new Set(sorted)].slice(0, 5));
    }
}
run().catch(console.error);
