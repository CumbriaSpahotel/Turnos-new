
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Mock window object
global.window = {
    DEBUG_MODE: true,
    normalizeId: (value) => {
        if (!value) return '';
        return String(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
    },
    normalizeForV9: (text) => {
        if (!text) return '';
        return String(text)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ');
    },
    normalizeDate: (value) => {
        if (!value) return '';
        if (value instanceof Date) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return String(value).split(/[T ]/)[0];
    },
    normalizeTipo: (value) => {
        const v = String(value || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (v.startsWith('VAC')) return 'VAC';
        if (v.startsWith('BAJA') || v === 'BM') return 'BAJA';
        if (v.startsWith('PERM')) return 'PERM';
        return v;
    },
    normalizeEstado: (value) => String(value || '').trim().toLowerCase() === 'anulado' ? 'anulado' : 'activo'
};

// Load supabase config
const configPath = 'supabase-config.js';
const configContent = fs.readFileSync(configPath, 'utf8');
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function diagnose() {
    const hotel = 'Cumbria Spa&Hotel';
    const weekStart = '2026-04-27';
    
    console.log(`=== DIAGNÓSTICO OBLIGATORIO: ${hotel} ${weekStart} ===\n`);

    // 1. Load Order Map
    const orderMapData = JSON.parse(fs.readFileSync('data/v9_excel_order_map.json', 'utf8'));
    const v9ExcelOrderMap = new Map();
    orderMapData.forEach(item => {
        const h = global.window.normalizeForV9(item.hotel);
        const w = item.week_start;
        const e = global.window.normalizeForV9(item.empleado_id);
        v9ExcelOrderMap.set(`${h}|${w}|${e}`, item.order);
    });

    // 2. Fetch Events
    const { data: events, error: evError } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .or(`hotel_id.eq."${hotel}",hotel.eq."${hotel}"`)
        .lte('fecha_inicio', '2026-05-10')
        .gte('fecha_fin', '2026-04-20');
    
    if (evError) throw evError;

    // 3. Fetch Employees
    const { data: employees, error: empError } = await supabase
        .from('empleados')
        .select('*');
    
    if (empError) throw empError;

    // 4. Filter relevant events for the week
    const weekEvents = events.filter(ev => {
        if (global.window.normalizeEstado(ev.estado) === 'anulado') return false;
        const fi = global.window.normalizeDate(ev.fecha_inicio);
        const ff = global.window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
        return (fi <= '2026-05-03' && ff >= '2026-04-27');
    });

    // A) baseRows
    console.log("A) baseRows (desde mapa para esta semana):");
    const weekBaseEntries = orderMapData.filter(item => 
        global.window.normalizeForV9(item.hotel) === global.window.normalizeForV9(hotel) &&
        item.week_start === weekStart
    ).sort((a,b) => a.order - b.order);

    weekBaseEntries.forEach(item => {
        console.log(`empleado: ${item.empleado_nombre.padEnd(15)} | puestoOrden: ${String(item.order).padEnd(5)} | origenOrden: Excel Map`);
    });
    if (weekBaseEntries.length === 0) console.log("No se encontraron entradas en el mapa para esta semana.");

    // B) eventos de ausencia
    console.log("\nB) eventos de ausencia:");
    weekEvents.forEach(ev => {
        const tipo = global.window.normalizeTipo(ev.tipo);
        if (['VAC', 'BAJA', 'PERM'].includes(tipo)) {
            const titular = ev.empleado_id || ev.empleado_nombre;
            const sustituto = ev.empleado_destino_id || ev.sustituto || 'NINGUNO';
            console.log(`titular: ${titular.padEnd(15)} | tipo: ${tipo.padEnd(6)} | sustituto: ${sustituto.padEnd(15)} | fechas: ${ev.fecha_inicio} a ${ev.fecha_fin}`);
        }
    });

    // C) operationalRows (Simulando lógica actual de admin.js)
    console.log("\nC) operationalRows (Simulado):");
    
    // Simulate sourceRows (titulars in Excel)
    const sourceRows = weekBaseEntries.map(item => ({
        empleadoId: item.empleado_id,
        displayName: item.empleado_nombre,
        rowIndex: item.order
    }));

    const handledTitulars = new Set();
    const operativeRows = [];

    // Step 1: Add titulars
    sourceRows.forEach(r => {
        const normTitular = global.window.normalizeId(r.empleadoId);
        operativeRows.push({
            id: r.empleadoId,
            name: r.displayName,
            puestoOrden: r.rowIndex,
            motivo: 'Titular Base'
        });
        handledTitulars.add(normTitular);
    });

    // Step 2: Add substitutes/refuerzos not in sourceRows
    weekEvents.forEach(ev => {
        const tipo = global.window.normalizeTipo(ev.tipo);
        const sustRaw = ev.empleado_destino_id || ev.sustituto;
        if (sustRaw) {
            const normSust = global.window.normalizeId(sustRaw);
            if (!handledTitulars.has(normSust)) {
                operativeRows.push({
                    id: sustRaw,
                    name: sustRaw, // Should be profile name in real code
                    puestoOrden: 999, // Fallback
                    motivo: tipo === 'VAC' || tipo === 'BAJA' ? 'Sustituto' : 'Evento'
                });
                handledTitulars.add(normSust);
            }
        }
    });

    // Sort
    operativeRows.sort((a, b) => {
        const keyA = `${global.window.normalizeForV9(hotel)}|${weekStart}|${global.window.normalizeForV9(a.id)}`;
        const keyB = `${global.window.normalizeForV9(hotel)}|${weekStart}|${global.window.normalizeForV9(b.id)}`;
        const orderA = v9ExcelOrderMap.get(keyA) ?? 999;
        const orderB = v9ExcelOrderMap.get(keyB) ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });

    operativeRows.forEach(row => {
        console.log(`empleadoVisible: ${row.name.padEnd(15)} | titularBase: ${row.motivo === 'Sustituto' ? '(Sustituye)' : row.name.padEnd(15)} | puestoOrden: ${String(row.puestoOrden).padEnd(5)} | motivo: ${row.motivo}`);
    });
}

diagnose().catch(console.error);
