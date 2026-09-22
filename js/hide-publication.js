(function (root) {
    'use strict';
    function mask(publication, from) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || Number.isNaN(Date.parse(from)) || new Date(from).toISOString().slice(0, 10) !== from) throw new Error('Fecha no válida.');
        const snapshot = JSON.parse(JSON.stringify(publication.snapshot_json));
        if (!snapshot || !(snapshot.rows || snapshot.empleados)?.length) throw new Error('La publicación no tiene un formato compatible.');
        let changed = false;
        for (const field of ['rows', 'empleados']) {
            for (const row of snapshot[field] || []) {
                for (const map of ['cells', 'dias', 'turnosOperativos']) {
                    if (!row[map]) continue;
                    for (const date of Object.keys(row[map])) {
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('La publicación usa fechas incompatibles. No se ha ocultado.');
                        if (date >= from && !row[map][date]?.publicHidden) {
                            row[map][date] = { code: '—', turno: '—', label: 'No publicado', publicHidden: true };
                            changed = true;
                        }
                    }
                }
            }
        }
        snapshot.metadata = { ...(snapshot.metadata || {}), public_hidden_from: from };
        return { snapshot, changed };
    }
    async function hide(api, from, hotel, progress = () => {}) {
        mask({ snapshot_json: { rows: [{}] } }, from);
        if (!['all', 'Cumbria Spa&Hotel', 'Sercotel Guadiana'].includes(hotel)) throw new Error('Selecciona un hotel válido.');
        const all = [];
        for (let offset = 0; ; offset += 500) {
            let q = api.supabase.from('publicaciones_cuadrante').select('*').eq('estado', 'activo')
                .gte('semana_fin', from).order('semana_inicio').order('hotel').order('version', { ascending: false }).order('id').range(offset, offset + 499);
            if (hotel !== 'all') q = q.eq('hotel', hotel);
            const { data, error } = await q;
            if (error) throw error;
            all.push(...(data || []));
            if (!data || data.length < 500) break;
        }
        const seen = new Set();
        const plans = [];
        for (const item of all) {
            const key = `${item.hotel}|${item.semana_inicio}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const masked = mask(item, from);
            if (masked.changed) plans.push({ item, snapshot: masked.snapshot });
        }
        let completed = 0;
        try {
            for (const { item, snapshot } of plans) {
                progress(`Ocultando ${completed + 1} de ${plans.length}: ${item.hotel}, ${item.semana_inicio}…`);
                const saved = await api.TurnosDB.publishCuadranteSnapshot({ semanaInicio: item.semana_inicio, semanaFin: item.semana_fin,
                    hotel: item.hotel, snapshot, resumen: { accion: 'ocultar_desde', desde: from }, usuario: 'ADMIN' });
                if (!saved?.success) throw new Error('No se pudo confirmar el guardado.');
                completed++;
                if (saved.needsManualCleanup || saved.warning) throw new Error(saved.warning || 'Es necesario revisar las versiones publicadas.');
            }
        } catch (error) { error.completed = completed; throw error; }
        return completed;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { mask, hide };
    if (!root?.document) return;
    root.openHidePublishedShifts = () => {
        if (document.getElementById('hide-publication')) return;
        const dialog = document.createElement('dialog');
        dialog.id = 'hide-publication';
        dialog.setAttribute('aria-labelledby', 'hide-publication-title');
        dialog.style.cssText = 'margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;width:min(520px,92vw);max-height:90vh;overflow:auto;';
        dialog.innerHTML = `<form style="display:grid;gap:16px;"><h2 id="hide-publication-title">Ocultar turnos publicados</h2>
            <label>Hotel<select name="hotel" style="display:block;padding:10px;width:100%;"><option value="all">Ambos hoteles</option><option>Cumbria Spa&amp;Hotel</option><option>Sercotel Guadiana</option></select></label>
            <label>Ocultar desde (incluido)<input name="from" type="date" required style="display:block;padding:10px;"></label>
            <p>Los turnos publicados desde esta fecha aparecerán como «No publicado». Los días anteriores y los turnos de Gestión Excel se conservarán. Para volver a mostrarlos, publica de nuevo las semanas correspondientes.</p>
            <p data-status role="status" aria-live="polite" style="white-space:pre-wrap;"></p>
            <div style="display:flex;gap:12px;"><button type="button" data-close>Cancelar</button><button type="submit">Ocultar desde esta fecha</button></div></form>`;
        dialog.querySelectorAll('button').forEach(b => { b.style.cssText = 'padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;'; });
        document.body.appendChild(dialog);
        const form = dialog.querySelector('form'), status = dialog.querySelector('[data-status]');
        let busy = false;
        dialog.querySelector('[data-close]').onclick = () => dialog.close();
        dialog.onclose = () => dialog.remove();
        dialog.oncancel = e => { if (busy) e.preventDefault(); };
        form.onsubmit = async e => {
            e.preventDefault();
            if (busy || !form.reportValidity()) return;
            busy = true;
            const from = form.elements.from.value, hotel = form.elements.hotel.value;
            [...form.elements].forEach(el => { el.disabled = true; });
            try {
                const count = await hide(root, from, hotel, text => { status.textContent = text; });
                status.textContent = count ? `Ocultación completada en ${count} publicaciones desde ${from.split('-').reverse().join('/')}.` : 'No hay turnos publicados que ocultar en ese periodo.';
            } catch (error) { status.textContent = `Proceso detenido. ${error.completed || 0} publicaciones modificadas. ${error.message}`; }
            finally {
                busy = false;
                [...form.elements].forEach(el => { el.disabled = false; });
                root.invalidatePreviewSnapshotCache?.('hide_publications');
                root.__lastGlobalStatus = null;
            }
        };
        dialog.showModal();
    };
})(typeof window !== 'undefined' ? window : null);
