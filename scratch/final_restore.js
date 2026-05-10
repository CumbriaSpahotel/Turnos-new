const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Find where the disaster started
const disasterStart = lines.findIndex(l => l.includes("window.diagnoseOperationalOrder"));
if (disasterStart !== -1) {
    // Replace from disasterStart to the end with a clean version of the missing functions
    const tail = `window.updateSmartProfileExplainer = () => {
    const tipoRadio  = document.querySelector('input[name="smart-tipo"]:checked');
    const rolRadio   = document.querySelector('input[name="smart-rol"]:checked');
    const hotelRadio = document.querySelector('input[name="smart-hotel"]:checked');
    const tipoEl   = document.getElementById('edit-emp-tipo');
    const rolEl    = document.getElementById('edit-emp-rol');
    const hotelEl  = document.getElementById('edit-emp-hotel');
    const estadoEl = document.getElementById('edit-emp-estado');
    const hotelHidEl = document.getElementById('edit-emp-hoteles-hidden');
    const estadoSelectEl = document.getElementById('edit-emp-estado-select');

    if (tipoRadio && tipoEl) {
        const v = tipoRadio.value;
        tipoEl.value = v === 'pendiente' ? 'ocasional' : v;
        if (estadoEl) estadoEl.value = v === 'pendiente' ? 'Pendiente' : (estadoSelectEl?.value || 'Activo');
    }
    if (rolRadio && rolEl) rolEl.value = rolRadio.value;
    if (hotelRadio && hotelEl) {
        if (hotelRadio.value === 'cumbria')  { hotelEl.value = 'Cumbria Spa&Hotel'; if (hotelHidEl) hotelHidEl.value = 'Cumbria Spa&Hotel'; }
        else if (hotelRadio.value === 'guadiana') { hotelEl.value = 'Sercotel Guadiana'; if (hotelHidEl) hotelHidEl.value = 'Sercotel Guadiana'; }
        else if (hotelRadio.value === 'ambos') { hotelEl.value = 'Cumbria Spa&Hotel'; if (hotelHidEl) hotelHidEl.value = 'Cumbria Spa&Hotel,Sercotel Guadiana'; }
    }

    const tipo  = tipoEl?.value || 'fijo';
    const rol   = rolEl?.value || 'titular';
    const estado = estadoEl?.value || estadoSelectEl?.value || 'Activo';
    const hotels = (hotelHidEl?.value || '').split(',').map(h => h.trim()).filter(Boolean);
    const isPend = estado === 'Pendiente' || String(document.getElementById('edit-emp-nombre')?.value || '').toLowerCase().includes('pendiente');

    const explainers = {
        fijo_titular: 'Empleado de plantilla con linea propia. Puede tener turnos base, vacaciones, permisos, bajas, IT y cambios.',
        fijo_sustituto: 'Empleado fijo que cubre a otra persona.',
        fijo_refuerzo: 'Empleado fijo de apoyo extra. No sustituye a nadie concreto.',
        ocasional_titular: 'Configuracion poco habitual. Ocasional con linea propia, aparece solo cuando tenga actividad real.',
        ocasional_sustituto: 'Ocasional que cubre a otra persona. Dias sin turno = -.',
        ocasional_refuerzo: 'Ocasional de apoyo extra. Aparece solo con turno o evento.'
    };

    let text = isPend
        ? '<strong>Ficha provisional.</strong> Usala en Admin Preview hasta tener nombre real.'
        : (explainers[tipo + '_' + rol] || 'Completa los campos para ver el comportamiento en el cuadrante.');
    if (hotels.length > 1) text += '<br><br>Puede trabajar en ambos hoteles y no se duplica.';
    const box = document.getElementById('empBehaviorText');
    if (box) box.innerHTML = text;

    document.querySelectorAll('.smart-choice').forEach(el => {
        const r = el.querySelector('input[type=radio]');
        if (r) {
            const isChecked = r.checked;
            el.style.borderColor = isChecked ? '#6366f1' : 'var(--border)';
            el.style.background = isChecked ? 'rgba(99,102,241,0.08)' : 'white';
        }
    });
};

window.saveEmployeeProfileV2 = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    window.updateSmartProfileExplainer?.();

    const empId   = window._employeeProfileId;
    const errBox  = document.getElementById('empProfileSaveError');
    const statusEl = document.getElementById('empProfileSaveStatus');
    const showErr = (msg) => {
        if (errBox) { errBox.textContent = msg; errBox.style.display = 'block'; }
        if (statusEl) { statusEl.textContent = 'Error: ' + msg; statusEl.style.color = '#dc2626'; }
    };
    if (!empId) { showErr('No hay empleado seleccionado.'); return; }

    const nombre  = document.getElementById('edit-emp-nombre')?.value?.trim() || '';
    const puesto  = document.getElementById('edit-emp-puesto')?.value?.trim() || '';
    const email   = document.getElementById('edit-emp-email')?.value?.trim() || null;
    const tipo    = document.getElementById('edit-emp-tipo')?.value || 'fijo';
    const rol     = document.getElementById('edit-emp-rol')?.value || 'titular';
    const estado  = document.getElementById('edit-emp-estado-select')?.value || document.getElementById('edit-emp-estado')?.value || 'Activo';
    const hotel   = document.getElementById('edit-emp-hotel')?.value || '';
    const hotelHidEl = document.getElementById('edit-emp-hoteles-hidden');
    const hotelesAsignados = hotelHidEl
        ? window.normalizeEmployeeHotels(hotelHidEl.value, hotel)
        : Array.from(document.querySelectorAll('input[name="edit-emp-hoteles"]:checked')).map(i => i.value);
    const vacAnuales = Number(document.getElementById('edit-emp-vac-anuales')?.value || 44);
    const observaciones = document.getElementById('edit-emp-observaciones')?.value?.trim() || null;

    const INVALID_TIPOS = ['sustituto', 'titular', 'refuerzo', 'placeholder', 'pendiente'];
    const INVALID_ROLES = ['fijo', 'ocasional', 'placeholder', 'pendiente', 'apoyo'];
    const VALID_HOTELS  = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

    if (INVALID_TIPOS.includes(tipo.toLowerCase())) { showErr(\`Tipo "\${tipo}" no es valido. \${tipo.toLowerCase() === 'sustituto' ? 'Sustituto es una funcion, no un tipo. Usa tipo Ocasional y rol Sustituto.' : 'Tipo solo puede ser Fijo u Ocasional.'}\`); return; }
    if (INVALID_ROLES.includes(rol.toLowerCase())) { showErr(\`Rol "\${rol}" no es valido. \${['fijo','ocasional'].includes(rol.toLowerCase()) ? \`"\${rol}" es tipo, no rol.\` : 'Rol solo puede ser Titular, Sustituto o Refuerzo.'}\`); return; }
    if (!nombre) { showErr('El nombre no puede estar vacio.'); return; }
    if (!puesto && estado !== 'Pendiente') { showErr('El puesto es obligatorio (excepto en empleados Pendientes).'); return; }
    if (!hotel) { showErr('Debes seleccionar un hotel principal.'); return; }
    if (!hotelesAsignados.length) { showErr('Debes marcar al menos un hotel operativo.'); return; }
    if (!hotelesAsignados.includes(hotel)) { showErr('El hotel principal debe estar incluido en los hoteles operativos.'); return; }
    if (hotelesAsignados.some(h => !VALID_HOTELS.includes(h))) { showErr('Hoteles operativos contiene valores invalidos: ' + hotelesAsignados.filter(h => !VALID_HOTELS.includes(h)).join(', ')); return; }

    const duplicate = (window.empleadosGlobales || []).filter(e =>
        String(e.id || '').trim() !== String(empId).trim() &&
        String(e.nombre || '').trim().toLowerCase() === nombre.toLowerCase() &&
        (e.hotel_id || e.hotel || '') === hotel &&
        e.activo !== false && !String(e.estado_empresa || e.estado || '').toLowerCase().includes('baja')
    );
    if (duplicate.length) { showErr(\`Ya existe un empleado activo con el nombre "\${nombre}" en \${hotel}. Revisa si estas creando un duplicado.\`); return; }

    if (errBox) errBox.style.display = 'none';
    if (statusEl) { statusEl.textContent = 'Guardando cambios...'; statusEl.style.color = 'var(--text-dim)'; }

    const payload = {
        id: empId, nombre, puesto, categoria: puesto, email,
        hotel, hotel_id: hotel, hoteles_asignados: hotelesAsignados,
        tipo, tipo_personal: tipo, contrato: tipo,
        rol, rol_operativo: rol,
        estado, estado_empresa: estado,
        activo: !['Baja', 'Inactivo', 'Excedencia'].includes(estado),
        vacaciones_anuales: tipo === 'ocasional' ? null : vacAnuales,
        ajuste_vacaciones_dias: 0, observaciones
    };

    try {
        await window.TurnosDB.upsertEmpleado(payload);
        window._employeeProfileUnsavedChanges = false;
        window.empleadosGlobales = await window.TurnosDB.getEmpleados();
        if (statusEl) { statusEl.textContent = 'Cambios guardados. ID protegido.'; statusEl.style.color = '#10b981'; }
        if (window.populateEmployees) await window.populateEmployees();
        window._employeeProfileTab = 'profile';
        window.renderEmployeeProfile();
    } catch (e) {
        console.error('[saveEmployeeProfileV2]', e);
        showErr('Error al guardar: ' + (e.message || String(e)));
    }
};

// describeCell centralizado en turnos-rules.js (Repetido por seguridad al final)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.renderDashboard, 1000);
    if (window.TurnosDB?.initRealtime) window.TurnosDB.initRealtime();
    window.updateSidebarBadges();
    setInterval(window.updateSidebarBadges, 30000);
});
`;
    lines = lines.slice(0, disasterStart);
    fs.writeFileSync(path, lines.join('\n') + '\n' + tail, 'utf8');
    console.log('Restored tail of admin.js.');
} else {
    console.log('Disaster point not found.');
}
