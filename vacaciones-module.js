/* vacaciones-module.js – Módulo Vacaciones Premium v1.0 */
(function(){
'use strict';
const $=s=>document.querySelector(s);
let _vacPeriods=[], _vacVisible=[], _vacInitialized=false;
const ESTADO_EXCLUIDO=/^(anulad|rechazad|cancelad)/i;
const ESTADO_COLOR={pendiente:'#f59e0b',activo:'#10b981',aprobado:'#3b82f6',anulado:'#6b7280',finalizado:'#6b7280'};
const ESTADO_BG={pendiente:'rgba(245,158,11,0.1)',activo:'rgba(16,185,129,0.1)',aprobado:'rgba(59,130,246,0.1)',anulado:'rgba(107,114,128,0.1)',finalizado:'rgba(107,114,128,0.08)'};

function fmtD(d){if(!d)return'—';const p=d.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0].slice(2)}`:d;}
function diffDays(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5)+1;}
function empLabel(id,emps){
  if(!id)return'—';
  const norm = window.normalizeId ? window.normalizeId(id) : String(id).trim().toLowerCase();
  const e=(emps||window.empleadosGlobales||[]).find(x=>(window.normalizeId?window.normalizeId(x.id):x.id)===norm || (window.normalizeId?window.normalizeId(x.nombre):x.nombre)===norm);
  if(e){
    const name=e.nombre||e.id;
    const idInt=e.id_interno||e.id;
    return`<span class="emp-label"><span class="emp-name">${name}</span><span class="emp-id-muted">${idInt}</span></span>`;
  }
  return id;
}

function normStr(s){return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');}

// Resolve legacy name to canonical empleado_id
function resolveEmpId(rawId, emps){
  if(!rawId) return rawId;
  const found = (emps||[]).find(e => 
    e.id === rawId || e.nombre === rawId ||
    normStr(e.id) === normStr(rawId) || normStr(e.nombre) === normStr(rawId)
  );
  return found ? found.id : rawId;
}

function empLabelPlain(id,emps){
  if(!id)return'—';
  const e=(emps||window.empleadosGlobales||[]).find(x=>x.id===id||x.nombre===id);
  if(e) return`${e.nombre||e.id} ${e.id_interno||e.id}`;
  return id;
}

function getSituacion(p, hoy){
  const fin=p.end||p.start;
  if(hoy>fin)return{label:'Finalizada',color:'#6b7280',bg:'rgba(107,114,128,0.08)'};
  if(p.start<=hoy&&fin>=hoy)return{label:'Actual',color:'#10b981',bg:'rgba(16,185,129,0.1)'};
  return{label:'Futura',color:'#3b82f6',bg:'rgba(59,130,246,0.1)'};
}

window.renderVacations = async () => {
  const area = $('#vacations-content');
  if(!area) return;
  // Read filter values BEFORE clearing DOM
  const hotel = $('#vacHotel')?.value || 'all';
  const emp = $('#vacEmp')?.value || 'all';
  const selectedYear = Number($('#vacYear')?.value || new Date().getFullYear());
  const status = $('#vacStatus')?.value || 'pending';
  area.innerHTML = '<div style="padding:3rem;text-align:center;opacity:0.5;">Cargando vacaciones...</div>';

  try {
    const [employees, hotels] = await Promise.all([
      window.TurnosDB.getEmpleados(),
      window.getAvailableHotels()
    ]);
    const hoy = new Date().toISOString().split('T')[0];

    // Fetch ALL VAC events (wide range) to discover available years
    const wideStart = `${new Date().getFullYear()-5}-01-01`;
    const wideEnd = `${new Date().getFullYear()+3}-12-31`;
    const allEventos = await window.TurnosDB.fetchEventos(wideStart, wideEnd);
    const allVacEventos = allEventos.filter(ev =>
      String(ev.tipo||'').toUpperCase().startsWith('VAC') &&
      !ESTADO_EXCLUIDO.test(ev.estado||'')
    );

    // Discover available years from data
    const yearSet = new Set();
    allVacEventos.forEach(ev => {
      if(ev.fecha_inicio) yearSet.add(Number(ev.fecha_inicio.slice(0,4)));
      if(ev.fecha_fin) yearSet.add(Number(ev.fecha_fin.slice(0,4)));
    });
    // Always include current year
    yearSet.add(new Date().getFullYear());
    const years = Array.from(yearSet).sort();

    // Validate selectedYear exists; fallback to current year
    const validYear = years.includes(selectedYear) ? selectedYear : new Date().getFullYear();
    const start = `${validYear}-01-01`;
    const end = `${validYear}-12-31`;

    // Filter VAC events for the selected year
    const vacEventos = allVacEventos.filter(ev => {
      const eStart = ev.fecha_inicio||'';
      const eEnd = ev.fecha_fin||eStart;
      return eStart <= end && eEnd >= start;
    });

    // NORMALIZE employee identity before grouping to prevent duplicates
    vacEventos.forEach(ev => {
      ev.empleado_id = resolveEmpId(ev.empleado_id, employees);
      if(ev.empleado_destino_id) ev.empleado_destino_id = resolveEmpId(ev.empleado_destino_id, employees);
    });

    // Group into periods
    const groupedVacs = window.groupConsecutiveEvents(vacEventos);

    // Post-group merge: merge groups with same normalized identity + overlapping/adjacent period
    const mergedGroups = [];
    groupedVacs.forEach(g => {
      const empId = resolveEmpId(g.empleado_id, employees);
      const hotel = g.hotel_origen||g.payload?.hotel_id||'General';
      const gStart = g.fecha_inicio;
      const gEnd = g.fecha_fin||g.fecha_inicio;
      // Find existing group to merge with
      const existing = mergedGroups.find(m => 
        m.empId === empId && m.hotel === hotel &&
        (m.tipo||'') === (g.tipo||'').split(' ')[0] &&
        // Overlapping or adjacent
        m.start <= gEnd && m.end >= gStart ||
        m.empId === empId && m.hotel === hotel && Math.abs(new Date(gStart+'T12:00:00')-new Date(m.end+'T12:00:00')) <= 864e5
      );
      if(existing){
        // Merge
        if(gStart < existing.start) existing.start = gStart;
        if(gEnd > existing.end) existing.end = gEnd;
        existing.ids = [...existing.ids, ...(g.ids||[g.id])];
        existing.isGroup = true;
        // Prefer sustituto that exists
        if(!existing.sustituto && (g.empleado_destino_id||g.payload?.sustituto)){
          existing.sustituto = g.empleado_destino_id||g.payload?.sustituto;
        }
        existing.days = Math.max(1, diffDays(existing.start, existing.end));
      } else {
        mergedGroups.push({
          id: g.id, ids: g.ids||[g.id], isGroup: g.isGroup||false,
          empId, hotel,
          start: gStart, end: gEnd,
          days: Math.max(1, diffDays(gStart, gEnd)),
          sustituto: g.empleado_destino_id||g.payload?.sustituto||'',
          estado: g.estado||'activo',
          tipo: (g.tipo||'').split(' ')[0]
        });
      }
    });
    const allPeriods = mergedGroups;

    // Primary filters (without employee — to compute available employees)
    let primaryFiltered = allPeriods.filter(p => {
      if(hotel!=='all'&&p.hotel!==hotel)return false;
      if(status==='pending')return p.end>=hoy;
      if(status==='past')return p.end<hoy;
      return true;
    });

    // Compute available employees from primary-filtered data
    const availableEmps = new Set();
    primaryFiltered.forEach(p => availableEmps.add(p.empId));

    // Reset employee selection if no longer valid
    let currentEmp = emp;
    if(currentEmp!=='all'&&!availableEmps.has(currentEmp)) currentEmp = 'all';

    // Apply employee filter
    let visible = currentEmp!=='all' ? primaryFiltered.filter(p=>p.empId===currentEmp) : primaryFiltered;
    visible.sort((a,b)=>a.start.localeCompare(b.start));
    _vacVisible = visible;
    // Keep compat with old variable
    window._visibleVacationPeriods = visible;

    // ── KPI CALCULATIONS ──
    const uniqueEmps = new Set(visible.map(p=>p.empId)).size;
    const totalDias = visible.reduce((s,p)=>s+p.days,0);
    const sinSust = visible.filter(p=>!p.sustituto).length;

    // Actualmente de vacaciones
    const actuales = visible.filter(p=>p.start<=hoy&&p.end>=hoy);
    // Próxima salida: first period with start > hoy
    const futuras = visible.filter(p=>p.start>hoy).sort((a,b)=>a.start.localeCompare(b.start));
    const proximaSalida = futuras.length>0 ? futuras[0] : null;

    // Mark primera futura as "Próxima salida"
    const proximaId = proximaSalida ? (proximaSalida.id||proximaSalida.start+proximaSalida.empId) : null;

    // Employee profiles for select
    const empProfiles = Array.from(availableEmps)
      .map(id=>{const pr=employees.find(e=>e.id===id||e.nombre===id);return{id,nombre:pr?.nombre||id,id_interno:pr?.id_interno||id, profile: pr};})
      .filter(e=>!e.id.includes('_DUP') && !window.isEmployeeTerminated(e.profile))
      .sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));

    // ── Actualmente KPI text ──
    let actualKPIHtml = '<span style="color:var(--text-dim);">Nadie</span>';
    if(actuales.length===1){
      actualKPIHtml=`<div style="font-weight:700;">${empLabel(actuales[0].empId,employees)}</div><div style="font-size:0.65rem;color:var(--text-dim);margin-top:2px;">${fmtD(actuales[0].start)} — ${fmtD(actuales[0].end)}</div>`;
    } else if(actuales.length>1){
      actualKPIHtml=`<div style="font-weight:700;">${actuales.length} personas</div><div style="font-size:0.6rem;color:var(--text-dim);margin-top:2px;">${actuales.map(a=>empLabel(a.empId,employees).split(' [')[0]).join(', ')}</div>`;
    }

    let proxKPIHtml = '<span style="color:var(--text-dim);">—</span>';
    if(proximaSalida){
      proxKPIHtml=`<div style="font-weight:700;">${empLabel(proximaSalida.empId,employees)}</div><div style="font-size:0.65rem;color:var(--text-dim);margin-top:2px;">${fmtD(proximaSalida.start)} — ${fmtD(proximaSalida.end)}</div>`;
    }

    area.innerHTML = `
      <!-- ALTA FORM -->
      <section class="glass-panel" style="padding:14px 18px;margin-bottom:14px;border:1px solid var(--border);border-radius:14px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <h2 id="vacFormTitle" style="margin:0;font-size:1rem;">Alta de vacaciones</h2>
          <div id="vacFormStatus" style="font-size:0.8rem;"></div>
        </div>
        <form id="vacCreateForm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;align-items:end;" onsubmit="window.saveVacation(event)">
          <label class="form-label-premium">Empleado
            <select id="newVacEmp" class="btn-premium" required onchange="window.syncVacationFormHotel()"></select>
          </label>
          <label class="form-label-premium">Hotel
            <select id="newVacHotel" class="btn-premium" required></select>
          </label>
          <label class="form-label-premium">Rango de Vacaciones
            <input id="newVacRange" type="text" placeholder="Seleccionar periodo..." class="btn-premium" readonly style="width:220px;cursor:pointer;">
            <input id="newVacStart" type="hidden"><input id="newVacEnd" type="hidden">
          </label>
          <label class="form-label-premium">Sustituto
            <select id="newVacSub" class="btn-premium"></select>
          </label>
          <div style="display:flex;gap:5px;">
            <button id="btnCreateVac" class="btn-publish-premium" type="submit" style="flex:1;margin:0;">Guardar</button>
            <button id="btnCancelEditVac" class="btn-premium" type="button" style="display:none;padding:10px;" onclick="window.resetVacationForm()">✖</button>
          </div>
        </form>
      </section>

      <!-- FILTROS -->
      <section class="glass-panel" style="padding:10px 18px;margin-bottom:14px;border:1px solid var(--border);border-radius:14px;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <h2 style="margin:0;font-size:0.9rem;white-space:nowrap;">Gestión anual</h2>
          <select id="vacHotel" class="btn-premium" onchange="window.renderVacations()">
            <option value="all">Todos los Hoteles</option>
            ${hotels.map(h=>`<option value="${h}"${hotel===h?' selected':''}>${h}</option>`).join('')}
          </select>
          <select id="vacEmp" class="btn-premium" onchange="window.renderVacations()">
            <option value="all">Todos los Empleados</option>
            ${empProfiles.length===0?'<option value="" disabled>Sin empleados</option>':empProfiles.map(e=>`<option value="${e.id}"${currentEmp===e.id?' selected':''}>${e.nombre} [${e.id_interno}]</option>`).join('')}
          </select>
          <select id="vacYear" class="btn-premium" onchange="window.renderVacations()">
            ${years.map(y=>`<option value="${y}"${validYear===y?' selected':''}>${y}</option>`).join('')}
          </select>
          <select id="vacStatus" class="btn-premium" onchange="window.renderVacations()">
            <option value="pending"${status==='pending'?' selected':''}>Pendientes / Actuales</option>
            <option value="past"${status==='past'?' selected':''}>Finalizadas</option>
            <option value="all"${status==='all'?' selected':''}>Todas</option>
          </select>
          <button class="btn-premium" onclick="window.renderVacations()" style="padding:8px 14px;font-size:0.7rem;">↻ Refrescar</button>
          <button id="btnSyncGapsVacaciones" class="btn-publish-premium" onclick="window.syncGapsFromExcel('btnSyncGapsVacaciones')" style="padding:8px 14px;font-size:0.7rem;margin-left:auto;background:linear-gradient(135deg,#34d399,#10b981);border:none;">
            <i class="fas fa-magic"></i> Completar Supabase
          </button>
        </div>
      </section>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:14px;">
        <div class="glass-panel" style="padding:14px;border:1px solid var(--border);border-radius:14px;">
          <div style="font-size:0.65rem;color:var(--text-dim);font-weight:800;text-transform:uppercase;">Periodos filtrados</div>
          <div style="font-size:1.6rem;font-weight:900;margin-top:4px;">${visible.length}</div>
        </div>
        <div class="glass-panel" style="padding:14px;border:1px solid var(--border);border-radius:14px;">
          <div style="font-size:0.65rem;color:var(--text-dim);font-weight:800;text-transform:uppercase;">Personas afectadas</div>
          <div style="font-size:1.6rem;font-weight:900;margin-top:4px;">${uniqueEmps}</div>
        </div>
        <div class="glass-panel" style="padding:14px;border:1px solid var(--border);border-radius:14px;">
          <div style="font-size:0.65rem;color:var(--text-dim);font-weight:800;text-transform:uppercase;">Actualmente de vacaciones</div>
          <div style="margin-top:6px;">${actualKPIHtml}</div>
        </div>
        <div class="glass-panel" style="padding:14px;border:1px solid var(--border);border-radius:14px;">
          <div style="font-size:0.65rem;color:var(--text-dim);font-weight:800;text-transform:uppercase;">Próxima salida</div>
          <div style="margin-top:6px;">${proxKPIHtml}</div>
        </div>
        <div class="glass-panel" style="padding:14px;border:1px solid var(--border);border-radius:14px;">
          <div style="font-size:0.65rem;color:var(--text-dim);font-weight:800;text-transform:uppercase;">Sin sustituto</div>
          <div style="font-size:1.6rem;font-weight:900;margin-top:4px;color:${sinSust>0?'#ef4444':'var(--text)'};">${sinSust}</div>
        </div>
        <div class="glass-panel" style="padding:14px;border:1px solid var(--border);border-radius:14px;">
          <div style="font-size:0.65rem;color:var(--text-dim);font-weight:800;text-transform:uppercase;">Días naturales</div>
          <div style="font-size:1.6rem;font-weight:900;margin-top:4px;">${totalDias}</div>
        </div>
      </div>

      <!-- TABLA -->
      ${visible.length===0?'<div style="padding:3rem;text-align:center;color:var(--text-dim);font-size:0.9rem;">No hay vacaciones para estos filtros.</div>':`
      <div class="glass-panel" style="padding:0;overflow:hidden;border-radius:15px;border:1px solid var(--border);">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:var(--bg3);">
            ${['Empleado','Hotel','Sustituto','Estado','Periodo / Duración','Situación','Acciones'].map(h=>`<th style="padding:12px;text-align:left;font-size:0.65rem;color:var(--text-dim);text-transform:uppercase;font-weight:800;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${visible.map((p,idx)=>{
            const sit=getSituacion(p,hoy);
            const isProxima=proximaId&&(p.id===proximaSalida.id&&p.start===proximaSalida.start&&p.empId===proximaSalida.empId);
            const sitLabel=isProxima?'Próxima salida':sit.label;
            const sitColor=isProxima?'#8b5cf6':sit.color;
            const sitBg=isProxima?'rgba(139,92,246,0.1)':sit.bg;
            const sameDay=p.start===p.end;
            const d=p.days;
            const sustTxt=p.sustituto?empLabel(p.sustituto,employees):null;
            const est=(p.estado||'activo').toLowerCase();
            return`<tr style="border-top:1px solid var(--border);">
              <td style="padding:12px;font-weight:700;">${empLabel(p.empId,employees)}</td>
              <td style="padding:12px;font-size:0.85rem;color:var(--text-dim);">${p.hotel}</td>
              <td style="padding:12px;font-size:0.85rem;">${sustTxt||'<span style="color:#f59e0b;font-weight:700;font-size:0.75rem;">Sin sustituto</span>'}</td>
              <td style="padding:12px;text-align:center;"><span style="background:${ESTADO_BG[est]||ESTADO_BG.activo};color:${ESTADO_COLOR[est]||ESTADO_COLOR.activo};padding:4px 10px;border-radius:8px;font-weight:800;font-size:0.6rem;">${est.toUpperCase()}</span></td>
              <td style="padding:12px;text-align:center;">
                <div style="font-weight:600;">${sameDay?fmtD(p.start):`${fmtD(p.start)} — ${fmtD(p.end)}`}</div>
                <div style="font-size:0.6rem;color:var(--text-dim);margin-top:3px;font-weight:700;">${d} día${d!==1?'s':''} natural${d!==1?'es':''}</div>
              </td>
              <td style="padding:12px;text-align:center;"><span style="background:${sitBg};color:${sitColor};padding:4px 10px;border-radius:8px;font-weight:800;font-size:0.6rem;">${sitLabel.toUpperCase()}</span></td>
              <td style="padding:12px;text-align:center;white-space:nowrap;">
                <button class="btn-premium" onclick="window.editVacationByIndex(${idx})" style="padding:5px 10px;font-size:0.65rem;margin:2px;">Gestionar</button>
                <button class="btn-premium" onclick="window.cancelVacationGroup(${idx})" style="padding:5px 10px;font-size:0.65rem;color:var(--danger);margin:2px;">Anular</button>
              </td>
            </tr>`;}).join('')}
          </tbody>
        </table>
      </div>`}
    `;

    // Populate form selects
    const newVacEmp = $('#newVacEmp');
    const newVacHotel = $('#newVacHotel');
    if(newVacEmp){
      newVacEmp.innerHTML = '<option value="" disabled selected>Seleccionar empleado...</option>' +
        employees.filter(e => !window.isEmployeeTerminated(e)).map(e=>`<option value="${e.id}">${e.nombre||e.id}${e.id_interno?' ['+e.id_interno+']':''}</option>`).join('');
    }
    if(newVacHotel){
      newVacHotel.innerHTML = '<option value="" disabled selected>Hotel...</option>' +
        hotels.map(h=>`<option value="${h}">${h}</option>`).join('');
    }
    window.syncVacationFormHotel?.();

    // Init Flatpickr
    if(typeof flatpickr!=='undefined'){
      flatpickr("#newVacRange",{
        mode:"range",dateFormat:"Y-m-d",altInput:true,altFormat:"d/m/y",
        locale:"es",monthSelectorType:"static",animate:true,
        onClose:(selectedDates)=>{
          if(selectedDates.length===2){
            $('#newVacStart').value=window.isoDate(selectedDates[0]);
            $('#newVacEnd').value=window.isoDate(selectedDates[1]);
          }else{$('#newVacStart').value='';$('#newVacEnd').value='';}
        }
      });
    }
  } catch(e) {
    console.error('[VACACIONES] Render error:',e);
    area.innerHTML=`<div style="padding:2rem;color:var(--danger);"><strong>Error cargando Vacaciones:</strong> ${e.message}</div>`;
  }
};

// Override cancelVacationGroup to use correct reference
window.cancelVacationGroup = async (idx) => {
  const p = window._visibleVacationPeriods?.[idx];
  if(!p) { alert('Error: periodo no encontrado.'); return; }
  const d = p.days || diffDays(p.start, p.end||p.start);
  const emps = window.empleadosGlobales||[];
  const label = empLabelPlain(p.empId, emps);
  const msg = `Vas a anular ${d} día${d!==1?'s':''} de vacaciones de ${label} del ${fmtD(p.start)} al ${fmtD(p.end||p.start)}.\n\n¿Continuar?`;
  if(!confirm(msg)) return;
  try {
    const ids = p.ids||[p.id];
    for(const id of ids){ await window.TurnosDB.anularEvento(id); }
    if(window.addLog) window.addLog(`Vacaciones anuladas: ${label} (${ids.length} eventos)`,'warn');
    await window.renderVacations();
  } catch(e) {
    const errMsg = e.message||String(e);
    if(errMsg.includes('RLS')||errMsg.includes('permission')||errMsg.includes('policy')){
      alert('Error: RLS/permiso bloquea la actualización. Contacte al administrador de Supabase.');
    } else {
      alert('Error al anular: ' + errMsg);
    }
  }
};

console.log('[VACACIONES MODULE] Loaded v1.1');
})();
