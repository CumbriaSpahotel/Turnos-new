(function (root) {
    'use strict';
    const HOTELS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    const addDays = (iso, n) => {
        const d = new Date(`${iso}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
    };
    function weeks(start) {
        const d = new Date(`${start}T12:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || Number.isNaN(d.getTime()) || addDays(start, 0) !== start || d.getUTCDay() !== 1) {
            throw new Error('Selecciona un lunes como fecha inicial.');
        }
        return Array.from({ length: 52 }, (_, i) => addDays(start, i * 7));
    }
    async function prepare(api, start, progress = () => {}) {
        const items = [], warnings = [];
        for (const [index, week] of weeks(start).entries()) {
            progress(`Revisando semana ${index + 1} de 52…`);
            api.invalidatePreviewSnapshotCache?.('annual_review');
            const snapshots = await api.buildPublicationSnapshotPreview(week, 'all');
            const selected = HOTELS.map(hotel => {
                const found = snapshots.filter(s => s.hotel_id === hotel);
                if (found.length !== 1 || !found[0].rows?.length || found[0].week_start !== week || found[0].week_end !== addDays(week, 6)) {
                    throw new Error(`Faltan datos válidos de ${hotel} para la semana ${week}. No se ha publicado nada.`);
                }
                return found[0];
            });
            const validation = await api.validatePublicationSnapshot(selected);
            if (!validation.ok) throw new Error(`Semana ${week}: ${(validation.errors || ['Validación incompleta']).join('\n')}`);
            warnings.push(...(validation.warnings || []).map(w => `${week}: ${w}`));
            items.push(...selected);
        }
        return { start, end: addDays(start, 363), items, warnings };
    }
    async function publish(api, plan, progress = () => {}) {
        const result = { published: 0, unchanged: 0, warnings: [] };
        try {
            for (const [index, snap] of plan.items.entries()) {
                progress(`Publicando ${index + 1} de ${plan.items.length}: ${snap.hotel_id}, ${snap.week_start}…`);
                const pending = await api.hasPendingPublicationChanges({ weekStart: snap.week_start, weekEnd: snap.week_end, hotels: [snap.hotel_id], snapshots: [snap] });
                if (!pending.hasChanges) { result.unchanged++; continue; }
                const saved = await api.TurnosDB.publishCuadranteSnapshot({ semanaInicio: snap.week_start, semanaFin: snap.week_end,
                    hotel: snap.hotel_id, snapshot: snap, resumen: { emps: snap.rows.length }, usuario: 'ADMIN' });
                if (!saved?.success) throw new Error('No se pudo confirmar el guardado.');
                result.published++;
                if (saved.warning || saved.needsManualCleanup) {
                    result.warnings.push(`${snap.hotel_id}, ${snap.week_start}: ${saved.warning || 'Limpieza de versiones pendiente.'}`);
                    throw new Error('La última publicación requiere revisar sus versiones antes de continuar.');
                }
            }
        } catch (error) { error.progress = result; throw error; }
        return result;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { weeks, prepare, publish };
    if (!root?.document) return;
    root.publishAllCurrentYear = () => {
        if (document.getElementById('annual-publication')) return;
        const dialog = document.createElement('dialog');
        dialog.id = 'annual-publication';
        dialog.setAttribute('aria-labelledby', 'annual-publication-title');
        dialog.style.cssText = 'margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;width:min(580px,92vw);max-height:90vh;overflow:auto;color:#1e293b;';
        dialog.innerHTML = `<h2 id="annual-publication-title">Publicar 52 semanas</h2>
            <p>Cumbria Spa&amp;Hotel y Sercotel Guadiana</p>
            <label>Fecha inicial (lunes)<input type="date" value="2027-01-04" style="display:block;padding:10px;margin:8px 0;"></label>
            <p data-period></p><p>Se revisarán las 52 semanas de ambos hoteles antes de publicar. Los turnos pasarán a estar visibles en el cuadrante público.</p>
            <p data-status role="status" aria-live="polite" style="white-space:pre-wrap;"></p>
            <details hidden><summary>Avisos de la revisión</summary><pre style="white-space:pre-wrap;"></pre></details>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;">
                <button data-review type="button">Revisar periodo</button>
                <button data-publish type="button" disabled>Confirmar y publicar ambos hoteles</button>
                <button data-close type="button">Cerrar</button>
            </div>`;
        document.body.appendChild(dialog);
        const date = dialog.querySelector('input');
        const status = dialog.querySelector('[data-status]');
        const review = dialog.querySelector('[data-review]');
        const confirm = dialog.querySelector('[data-publish]');
        const close = dialog.querySelector('[data-close]');
        dialog.querySelectorAll('button').forEach(b => { b.style.cssText = 'padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;'; });
        let busy = false, plan = null;
        const format = iso => iso.split('-').reverse().join('/');
        const updatePeriod = () => {
            plan = null; confirm.disabled = true;
            try { weeks(date.value); dialog.querySelector('[data-period]').textContent = `${format(date.value)} – ${format(addDays(date.value, 363))} · 52 semanas · 104 publicaciones`; }
            catch (error) { dialog.querySelector('[data-period]').textContent = error.message; }
        };
        date.onchange = updatePeriod;
        updatePeriod();
        close.onclick = () => dialog.close();
        dialog.onclose = () => dialog.remove();
        dialog.oncancel = event => { if (busy) event.preventDefault(); };
        const setBusy = value => { busy = value; date.disabled = review.disabled = close.disabled = value; confirm.disabled = value || !plan; };
        const checkUnsaved = () => {
            if (root.pendingChangesCount > 0 || (root.getExcelDiff?.() || []).length) throw new Error('Guarda los cambios de turnos antes de revisar y publicar el periodo.');
        };
        review.onclick = async () => {
            if (busy) return;
            setBusy(true); plan = null;
            try {
                checkUnsaved();
                plan = await prepare(root, date.value, text => { status.textContent = text; });
                status.textContent = `Revisión completada: 52 semanas de ambos hoteles, del ${format(plan.start)} al ${format(plan.end)}. Puedes confirmar la publicación.`;
                const details = dialog.querySelector('details');
                details.hidden = !plan.warnings.length;
                details.querySelector('pre').textContent = plan.warnings.join('\n');
            } catch (error) { status.textContent = `No se ha publicado nada. ${error.message}`; }
            finally { setBusy(false); }
        };
        confirm.onclick = async () => {
            if (busy || !plan) return;
            setBusy(true);
            try {
                checkUnsaved();
                // Re-read and validate the entire period to avoid publishing stale reviewed data.
                const fresh = await prepare(root, date.value, text => { status.textContent = text; });
                if (JSON.stringify(fresh.items) !== JSON.stringify(plan.items)) {
                    plan = null;
                    throw new Error('Los turnos han cambiado desde la revisión. Revisa el periodo de nuevo antes de confirmar.');
                }
                const result = await publish(root, fresh, text => { status.textContent = text; });
                status.textContent = `Periodo completado: ${result.published} publicaciones guardadas y ${result.unchanged} ya estaban actualizadas.`;
                plan = null;
            } catch (error) {
                const p = error.progress;
                status.textContent = p ? `Proceso detenido: ${p.published} guardadas y ${p.unchanged} ya actualizadas. ${error.message}\n${p.warnings.join('\n')}\nPuedes revisar de nuevo para continuar con lo pendiente.` : `No se ha publicado nada. ${error.message}`;
                plan = null;
            } finally {
                root.invalidatePreviewSnapshotCache?.('annual_publication_finished');
                root.__lastGlobalStatus = null;
                setBusy(false);
            }
        };
        dialog.showModal();
    };
})(typeof window !== 'undefined' ? window : null);
