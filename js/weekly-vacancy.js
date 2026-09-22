(function (root) {
    'use strict';
    const addDays = (day, n) => {
        const date = new Date(`${day}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + n);
        return date.toISOString().slice(0, 10);
    };
    const validDate = day => /^\d{4}-\d{2}-\d{2}$/.test(day || '') &&
        !Number.isNaN(Date.parse(`${day}T12:00:00Z`)) && addDays(day, 0) === day;

    async function assign(client, { vacancy, hotel, week, start, end, employee }) {
        if (!String(vacancy || '').startsWith('vacante-') || !hotel) throw new Error('Plaza vacante no válida.');
        if (![week, start, end].every(validDate) || new Date(`${week}T12:00:00Z`).getUTCDay() !== 1 ||
            start < week || end > addDays(week, 6) || end < start) throw new Error('Elige fechas dentro de esta semana.');
        if (!employee?.id || employee.activo === false || !/^EMP-\d{4,}$/.test(employee.id_interno || '') ||
            String(employee.id).startsWith('vacante-')) throw new Error('Selecciona un empleado activo con identificador válido.');

        const source = await client.from('turnos').select('fecha,turno')
            .eq('empleado_id', vacancy).eq('hotel_id', hotel).gte('fecha', start).lte('fecha', end);
        if (source.error) throw source.error;
        const dates = [];
        for (let day = start; day <= end; day = addDays(day, 1)) dates.push(day);
        if (source.data?.length !== dates.length || dates.some(day => !source.data.some(row => row.fecha === day))) {
            throw new Error('La plaza ya ha cambiado o faltan días. Actualiza Gestión Excel y vuelve a intentarlo.');
        }
        // Include the aliases used by the employee registry; never replace another schedule.
        const aliases = [...new Set([employee.id, employee.id_interno, employee.nombre, employee.uuid].filter(Boolean))];
        const existing = await client.from('turnos').select('fecha,hotel_id,turno')
            .in('empleado_id', aliases).gte('fecha', start).lte('fecha', end);
        if (existing.error) throw existing.error;
        if (existing.data?.length) throw new Error(`Esta persona ya tiene turnos en las fechas elegidas (${existing.data[0].fecha}, ${existing.data[0].hotel_id}). Elige otra persona o reduce las fechas.`);

        // One UPDATE is atomic: a unique employee/date conflict rolls back the whole assignment.
        // Only identity changes; shifts, rest days and all other weeks stay intact.
        const saved = await client.from('turnos').update({ empleado_id: employee.id, updated_by: 'ADMIN_EXCEL_WEEK_ASSIGNMENT' })
            .eq('empleado_id', vacancy).eq('hotel_id', hotel).gte('fecha', start).lte('fecha', end)
            .select('fecha,turno');
        if (saved.error) {
            if (saved.error.code === '23505') throw new Error('Esta persona acaba de recibir otros turnos. No se ha asignado la semana. Actualiza y revisa las fechas.');
            throw saved.error;
        }
        if (saved.data?.length !== dates.length) throw new Error('No se ha podido confirmar la asignación completa. Actualiza Gestión Excel antes de volver a intentarlo.');
        return saved.data;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { assign, addDays };
    if (!root?.document) return;

    root.openWeeklyVacancy = async button => {
        if (root.pendingChangesCount > 0) {
            root.alert('Guarda los cambios de turnos antes de asignar un sustituto.');
            return;
        }
        if (document.getElementById('weekly-vacancy-dialog')) return;
        const { vacancy, hotel, week } = button.dataset;
        const dialog = document.createElement('dialog');
        dialog.id = 'weekly-vacancy-dialog';
        dialog.setAttribute('aria-labelledby', 'weekly-vacancy-title');
        dialog.style.cssText = 'margin:auto;max-height:90vh;overflow:auto;border:1px solid #e2e8f0;border-radius:16px;padding:24px;width:min(480px,90vw);box-sizing:border-box;color:#1e293b;box-shadow:0 12px 48px #0003;';
        dialog.innerHTML = `<form style="display:grid;gap:16px;">
            <h2 id="weekly-vacancy-title" style="margin:0;font-size:1.2rem;">Asignar sustituto esta semana</h2>
            <p data-summary style="margin:0;"></p>
            <label>Persona<select name="employee" required style="display:block;width:100%;padding:10px;margin-top:6px;"><option value="">Cargando empleados…</option></select></label>
            <div style="display:flex;gap:16px;flex-wrap:wrap;">
                <label>Desde<input name="start" type="date" required style="display:block;padding:8px;margin-top:6px;"></label>
                <label>Hasta<input name="end" type="date" required style="display:block;padding:8px;margin-top:6px;"></label>
            </div>
            <p style="margin:0;font-size:.9rem;">La persona elegida recibirá los turnos y descansos de estas fechas. Las demás semanas seguirán sin asignar. Si aún no está registrada, añádela primero en Empleados.</p>
            <p data-status role="status" aria-live="polite" style="margin:0;"></p>
            <div style="display:flex;justify-content:flex-end;gap:12px;">
                <button type="button" data-close class="btn-premium" style="padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;background:white;color:#334155;cursor:pointer;">Cancelar</button>
                <button type="submit" class="btn-premium" style="padding:10px 14px;border:0;border-radius:8px;background:#2563eb;color:white;cursor:pointer;" disabled>Asignar sustituto</button>
            </div>
        </form>`;
        document.body.appendChild(dialog);
        dialog.addEventListener('close', () => { dialog.remove(); button.focus(); });
        const form = dialog.querySelector('form');
        const submit = form.querySelector('[type=submit]');
        const close = form.querySelector('[data-close]');
        const status = form.querySelector('[data-status]');
        let saving = false;
        dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
        close.onclick = () => dialog.close();
        const formatDate = day => day.split('-').reverse().join('/');
        form.querySelector('[data-summary]').textContent = `${hotel} · ${formatDate(week)} – ${formatDate(addDays(week, 6))}`;
        for (const name of ['start', 'end']) {
            form.elements[name].min = week;
            form.elements[name].max = addDays(week, 6);
            form.elements[name].value = name === 'start' ? week : addDays(week, 6);
        }
        dialog.showModal();
        let employees;
        try {
            employees = (await root.TurnosDB.getEmpleados()).filter(e => e.activo !== false && /^EMP-\d{4,}$/.test(e.id_interno || '') && !String(e.id).startsWith('vacante-'));
            employees.sort((a, b) => String(a.nombre || a.id).localeCompare(String(b.nombre || b.id)));
            form.elements.employee.replaceChildren(new Option(employees.length ? 'Selecciona una persona' : 'No hay empleados disponibles', ''));
            for (const emp of employees) form.elements.employee.add(new Option(`${emp.nombre || emp.id} [${emp.id_interno}]`, emp.id));
            submit.disabled = employees.length === 0;
        } catch (error) { status.textContent = `No se pudieron cargar los empleados: ${error.message}`; }
        form.onsubmit = async event => {
            event.preventDefault();
            if (saving || !form.reportValidity()) return;
            saving = true; submit.disabled = true; close.disabled = true;
            status.textContent = 'Comprobando y guardando…';
            try {
                await assign(root.supabase, { vacancy, hotel, week, start: form.elements.start.value, end: form.elements.end.value,
                    employee: employees.find(e => e.id === form.elements.employee.value) });
                dialog.close();
                root.excelFilters = { ...(root.excelFilters || {}), search: '', onlyPending: false };
                await root.renderExcelView();
            } catch (error) { status.textContent = error.message || 'No se pudo guardar la asignación.'; }
            finally { saving = false; submit.disabled = false; close.disabled = false; }
        };
    };
})(typeof window !== 'undefined' ? window : null);
