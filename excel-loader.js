/* excel-loader.js — Cargador compartido de Excel para index, admin y mobile
   Única implementación canónica de:
   - Conversión de fechas seriales XLSX, Date y string ISO
   - Normalización de turnos a M / T / N / D
   - Preservación de rowIndex y displayName
   Caché global: window._sharedExcelSourceRows
*/
(function () {
    const EXCEL_FILE = 'Plantilla%20Cuadrante%20Turnos%20v.8.0.xlsx';
    const HOTEL_SHEETS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

    /**
     * Convierte cualquier valor de celda de fecha Excel a "YYYY-MM-DD" local.
     * Soporta:
     *   - número serial XLSX (ej: 45678)
     *   - objeto Date (cuando cellDates:true está activo)
     *   - string ISO o parcial ("2025-04-21T00:00:00.000Z" → "2025-04-21")
     */
    function excelCellDate(value) {
        if (!value) return null;

        if (typeof value === 'number') {
            // Número serial XLSX → fecha local (no UTC, para evitar desfase de día)
            const ms = Math.round((value - 25569) * 86400 * 1000);
            const d = new Date(ms);
            if (isNaN(d.getTime())) return null;
            return [
                d.getFullYear(),
                String(d.getMonth() + 1).padStart(2, '0'),
                String(d.getDate()).padStart(2, '0')
            ].join('-');
        }

        if (value instanceof Date) {
            if (isNaN(value.getTime())) return null;
            return [
                value.getFullYear(),
                String(value.getMonth() + 1).padStart(2, '0'),
                String(value.getDate()).padStart(2, '0')
            ].join('-');
        }

        if (typeof value === 'string') {
            // String ISO: tomar solo la parte de fecha para evitar desfase UTC
            const part = value.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
        }

        return null;
    }

    /**
     * Normaliza el valor de una celda de turno a M / T / N / D.
     * Acepta: "Mañana", "mañana", "M", "M ", "Tarde", "Noche", "Descanso", etc.
     * Devuelve el valor original (trimado) si no coincide con ningún patrón.
     */
    function shiftFromExcel(value) {
        const text = String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        if (!text) return '';
        if (text.startsWith('m') || text.includes('manana')) return 'M';
        if (text.startsWith('t') || text.includes('tarde'))  return 'T';
        if (text.startsWith('n') || text.includes('noche'))  return 'N';
        if (text.startsWith('d') || text.includes('descanso')) return 'D';
        return String(value || '').trim();
    }

    /**
     * Carga y parsea el Excel de plantilla.
     * Resultado cacheado en window._sharedExcelSourceRows.
     * Devuelve { [hotelName]: [ { hotel, rowIndex, weekStart, displayName, empleadoId, values[] } ] }
     */
    async function loadExcelSourceRows() {
        if (window._sharedExcelSourceRows) return window._sharedExcelSourceRows;
        if (!window.XLSX) {
            console.warn('[ExcelLoader] XLSX no disponible.');
            return {};
        }
        try {
            const response = await fetch(EXCEL_FILE, { cache: 'no-store' });
            if (!response.ok) {
                console.warn(`[ExcelLoader] HTTP ${response.status} al cargar el Excel.`);
                return {};
            }
            const buffer = await response.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
            const result = {};

            HOTEL_SHEETS.forEach(hotel => {
                const sheet = workbook.Sheets[hotel];
                if (!sheet) return;
                const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
                result[hotel] = matrix.slice(1)
                    .map((row, index) => ({
                        hotel,
                        rowIndex: index,                              // conserva orden Excel
                        weekStart: excelCellDate(row[0]),             // fecha canónica YYYY-MM-DD
                        displayName: String(row[1] || '').trim(),    // nombre tal cual aparece
                        empleadoId:  String(row[1] || '').trim(),    // clave de normalización
                        values: [0, 1, 2, 3, 4, 5, 6].map(i =>
                            shiftFromExcel(row[i + 2])               // normalizado M/T/N/D
                        )
                    }))
                    .filter(r => r.weekStart && r.empleadoId);
            });

            window._sharedExcelSourceRows = result;
            return result;
        } catch (e) {
            console.warn('[ExcelLoader] Error al cargar el Excel:', e);
            return {};
        }
    }

    /** Invalida la caché (útil si el archivo cambia en sesión) */
    function clearCache() {
        window._sharedExcelSourceRows = null;
    }

    window.ExcelLoader = { loadExcelSourceRows, excelCellDate, shiftFromExcel, clearCache };
})();
