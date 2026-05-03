/* sync-gaps.js – Lógica para sincronizar huecos detectados en Excel con Supabase
   v1.0 - Estabilización de Integridad
*/
(function () {
    'use strict';

    /**
     * Sincroniza huecos (ausencias en Excel no registradas en Supabase).
     * Sigue los protocolos de protección: Dry Run y Autorización.
     */
    window.syncGapsFromExcel = async (btnId = 'btnSyncGaps') => {
        if (!window.ExcelLoader || !window.TurnosDB) {
            alert('Error: ExcelLoader o TurnosDB no disponibles.');
            return;
        }

        const btn = document.getElementById(btnId) || document.activeElement;
        const originalText = btn ? btn.innerHTML : '';
        
        try {
            if (btn && btn.tagName === 'BUTTON') {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando Excel...';
            }

            console.log('[SyncGaps] Iniciando análisis de huecos...');
            
            // 1. Cargar Excel
            const excelHotels = await window.ExcelLoader.loadExcelSourceRows();
            const allExcelRows = Object.values(excelHotels).flat();
            
            if (allExcelRows.length === 0) {
                alert('No se pudieron cargar datos del Excel.');
                return;
            }

            // 2. Determinar rango de fechas del Excel para filtrar Supabase
            let minDate = '9999-12-31', maxDate = '0000-01-01';
            allExcelRows.forEach(row => {
                if (row.weekStart < minDate) minDate = row.weekStart;
                const lastDay = window.addIsoDays ? window.addIsoDays(row.weekStart, 6) : row.weekStart;
                if (lastDay > maxDate) maxDate = lastDay;
            });

            // 3. Cargar Eventos de Supabase en ese rango
            const dbEvents = await window.TurnosDB.fetchEventos(minDate, maxDate);
            const activeDbEvents = dbEvents.filter(ev => !['anulado', 'rechazado'].includes((ev.estado || 'activo').toLowerCase()));

            // 4. Mapear eventos DB para búsqueda rápida: "fecha_empleado_tipo"
            const dbMap = new Set();
            activeDbEvents.forEach(ev => {
                const empId = window.normalizeId(ev.empleado_id);
                const start = ev.fecha_inicio;
                const end = ev.fecha_fin || start;
                const tipo = String(ev.tipo || '').toUpperCase().split(' ')[0];
                
                // Marcamos cada día del periodo
                let curr = start;
                while (curr <= end) {
                    dbMap.add(`${curr}_${empId}_${tipo}`);
                    if (window.addIsoDays) curr = window.addIsoDays(curr, 1);
                    else break; 
                }
            });

            // 5. Encontrar huecos
            const gaps = [];
            const absenceCodes = ['VAC', 'BAJA', 'IT', 'PERM', 'PERMISO', 'FORM', 'FORMACION'];
            
            allExcelRows.forEach(row => {
                const empId = window.normalizeId(row.empleadoId);
                row.values.forEach((val, i) => {
                    const code = String(val || '').toUpperCase();
                    if (absenceCodes.some(ac => code.startsWith(ac))) {
                        const date = window.addIsoDays(row.weekStart, i);
                        const tipoBase = absenceCodes.find(ac => code.startsWith(ac));
                        const key = `${date}_${empId}_${tipoBase}`;
                        
                        if (!dbMap.has(key)) {
                            gaps.push({
                                date,
                                empId: row.empleadoId,
                                hotel: row.hotel,
                                type: code,
                                canonicalType: tipoBase === 'VAC' ? 'VAC' : (tipoBase.startsWith('BAJA') || tipoBase === 'IT' ? 'BAJA' : 'PERMISO')
                            });
                        }
                    }
                });
            });

            console.log(`[SyncGaps] Huecos detectados: ${gaps.length}`);

            if (gaps.length === 0) {
                alert('No se han detectado huecos. El sistema está sincronizado con el Excel.');
                return;
            }

            // 6. Reporte y Autorización
            const report = gaps.map(g => `- ${g.date}: ${g.empId} (${g.type}) en ${g.hotel}`).join('\n');
            const confirmMsg = `Se han detectado ${gaps.length} ausencias en el Excel que no están en Supabase:\n\n${gaps.length > 10 ? gaps.slice(0, 10).map(g => `- ${g.date}: ${g.empId}`).join('\n') + '\n...y ' + (gaps.length - 10) + ' más.' : report}\n\n¿Deseas registrar estos huecos en Supabase ahora?`;

            if (confirm(confirmMsg)) {
                // Protocolo de seguridad: backup ya hecho (admin.js.bak), procedemos con upsert
                let count = 0;
                for (const gap of gaps) {
                    await window.TurnosDB.upsertEvento({
                        tipo: gap.canonicalType,
                        empleado_id: gap.empId,
                        hotel_origen: gap.hotel,
                        fecha_inicio: gap.date,
                        fecha_fin: gap.date,
                        estado: 'activo',
                        observaciones: `Sincronizado automáticamente desde Excel (${gap.type})`,
                        payload: { source: 'sync_gaps_excel', original_code: gap.type }
                    });
                    count++;
                    if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Registrando ${count}/${gaps.length}...`;
                }
                
                alert(`${count} registros creados correctamente. Refrescando vistas...`);
                if (window.refreshBajas) await window.refreshBajas();
                if (window.renderVacations) await window.renderVacations();
                if (window.renderDashboard) await window.renderDashboard();
            }

        } catch (err) {
            console.error('[SyncGaps ERROR]', err);
            alert('Error durante la sincronización: ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    };

    console.log('[SyncGaps] Módulo cargado.');
})();
