/**
 * AUDIT V12.1 FINAL — Lee snapshots de Supabase directamente
 * No depende del runtime de admin.js
 * Compara la estructura actual de los snapshots publicados vs. lo esperado.
 * 
 * Semanas dañadas a inspeccionar (Cumbria Spa&Hotel):
 *   2026-05-04 a 2026-05-25
 * 
 * SOLO LECTURA — No escribe nada.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const WEEKS_CUMBRIA = ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];
const HOTEL_TARGET  = 'Cumbria Spa&Hotel';

// Códigos de turno operativos válidos
const VALID_OPERATIVE_CODES = new Set(['M', 'T', 'N', 'D']);
// Códigos de ausencia canónicos
const VALID_ABSENCE_CODES   = new Set(['VAC', 'BAJA', 'PERM', 'FORM']);

async function auditWeek(weekStart) {
    const { data, error } = await client
        .from('publicaciones_cuadrante')
        .select('semana_inicio, semana_fin, version_snapshot, snapshot_json, created_at')
        .eq('hotel', HOTEL_TARGET)
        .eq('semana_inicio', weekStart)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) return { week: weekStart, error: error.message };
    if (!data || data.length === 0) return { week: weekStart, status: 'NO_SNAPSHOT', rows: 0 };

    const snap = data[0];
    const version = snap.version_snapshot || 'unknown';
    const snapJson = snap.snapshot_json;

    // La estructura puede ser { rows: [...] } o directamente los empleados
    let rows = [];
    if (snapJson && snapJson.rows) {
        rows = snapJson.rows;
    } else if (snapJson && snapJson.empleados) {
        rows = snapJson.empleados;
    } else if (Array.isArray(snapJson)) {
        rows = snapJson;
    }

    const report = {
        week: weekStart,
        version,
        totalRows: rows.length,
        operativos: 0,
        ausencias_informativas: 0,
        filas_con_guiones: [],       // rowType='operativo' pero celdas vacías
        ausencias_sin_codigo: [],    // rowType='ausencia_informativa' sin VAC/BAJA/PERM
        filas_vacias_total: [],
        sample_rows: []              // Primeras 5 filas para inspección visual
    };

    rows.forEach(row => {
        const nombre = row.nombreVisible || row.nombre || '?';
        const rowType = row.rowType || 'operativo';

        if (rowType === 'ausencia_informativa') report.ausencias_informativas++;
        else report.operativos++;

        const dias = row.cells || row.dias || {};
        const cellValues = Object.entries(dias);

        const codesPresentes = cellValues.map(([d, c]) => (c.code || '').toUpperCase().trim());
        const hasOperative = codesPresentes.some(c => VALID_OPERATIVE_CODES.has(c));
        const hasAbsence   = codesPresentes.some(c => VALID_ABSENCE_CODES.has(c));
        const allEmpty     = codesPresentes.every(c => !c || c === '—' || c === '-');
        const hasGuiones   = codesPresentes.some(c => c === '—' || c === '-' || c === '');

        if (rowType === 'operativo' && !hasOperative && !hasAbsence) {
            report.filas_con_guiones.push({ nombre, rowType, codes: codesPresentes });
        }

        if (rowType === 'ausencia_informativa' && !hasAbsence) {
            report.ausencias_sin_codigo.push({ nombre, rowType, codes: codesPresentes });
        }

        if (allEmpty) {
            report.filas_vacias_total.push({ nombre, rowType });
        }
    });

    // Muestra las primeras 5 filas (nombre + códigos por día)
    report.sample_rows = rows.slice(0, 5).map(row => ({
        nombreVisible: row.nombreVisible || row.nombre,
        rowType: row.rowType || 'operativo',
        titularOriginalId: row.titularOriginalId || null,
        cells: Object.entries(row.cells || row.dias || {}).reduce((acc, [d, c]) => {
            acc[d] = { code: c.code, type: c.type, isAbsence: c.isAbsence };
            return acc;
        }, {})
    }));

    // Estado global de la semana
    const issues = report.filas_con_guiones.length + report.ausencias_sin_codigo.length;
    report.status = issues === 0 ? 'OK' : `DAÑADO (${issues} problemas)`;

    return report;
}

async function main() {
    console.log('\n========================================');
    console.log('  AUDIT V12.1 — SOLO LECTURA — CUMBRIA');
    console.log('========================================\n');

    const fullReport = {};

    for (const week of WEEKS_CUMBRIA) {
        process.stdout.write(`Auditando semana ${week}... `);
        const result = await auditWeek(week);
        fullReport[week] = result;
        console.log(result.status || result.error || 'ERROR');
    }

    // Guardar resultado
    const outPath = `${__dirname}/audit_v12_result.json`;
    fs.writeFileSync(outPath, JSON.stringify(fullReport, null, 2), 'utf8');
    console.log(`\nResultado guardado en: ${outPath}`);

    // Resumen ejecutivo
    console.log('\n--- RESUMEN EJECUTIVO ---');
    Object.entries(fullReport).forEach(([week, r]) => {
        const status = r.status || `ERROR: ${r.error}`;
        const guiones = r.filas_con_guiones?.length || 0;
        const sinCodigo = r.ausencias_sin_codigo?.length || 0;
        console.log(`  ${week}: ${status} | Rows=${r.totalRows || 0} | Guiones=${guiones} | AusenciasSinCód=${sinCodigo} | v=${r.version || '?'}`);
    });
    console.log('');
}

main().catch(e => {
    console.error('Error fatal:', e);
    process.exit(1);
});
