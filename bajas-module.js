/* bajas-module.js – Módulo Bajas y Permisos v1.0 */
(function(){
'use strict';
const $=s=>document.querySelector(s);
let _bajasData=[], _bajasFiltered=[], _bajasGrouped=[];
let _editingBaja=null, _bajasInitialized=false;
// Persistent filter state (survives innerHTML re-renders)
const _bajasState = {
  hotel:'all', empSearch:'', tipo:'all', estados:['pendiente','activo'],
  sustSearch:'', noSust:false, dateStart:todayISO(), dateEnd:''
};
let _skipDomCache = false;

const TIPOS_BAJA=['BAJA','PERM','PERMISO','IT','BAJA_MEDICA','FORMACION','AUSENCIA','OTRO'];
const TIPO_LABEL={BAJA:'Baja Médica / IT',PERM:'Permiso',PERMISO:'Permiso',IT:'Baja Médica / IT',BAJA_MEDICA:'Baja Médica / IT',FORMACION:'Formación',AUSENCIA:'Ausencia',OTRO:'Otro'};
const TIPO_COLOR={BAJA:'#475569',PERM:'#a78bfa',PERMISO:'#a78bfa',IT:'#475569',BAJA_MEDICA:'#475569',FORMACION:'#60a5fa',AUSENCIA:'#94a3b8',OTRO:'#94a3b8'};
const TIPO_BG={BAJA:'#f1f5f9',PERM:'rgba(139,92,246,0.1)',PERMISO:'rgba(139,92,246,0.1)',IT:'#f1f5f9',BAJA_MEDICA:'#f1f5f9',FORMACION:'rgba(96,165,250,0.1)',AUSENCIA:'rgba(148,163,184,0.1)',OTRO:'rgba(148,163,184,0.1)'};
const ESTADO_COLOR={pendiente:'#f59e0b',activo:'#10b981',aprobado:'#3b82f6',rechazado:'#ef4444',anulado:'#6b7280',finalizado:'#6b7280'};
const ESTADO_BG={pendiente:'rgba(245,158,11,0.1)',activo:'rgba(16,185,129,0.1)',aprobado:'rgba(59,130,246,0.1)',rechazado:'rgba(239,68,68,0.1)',anulado:'rgba(107,114,128,0.1)',finalizado:'rgba(107,114,128,0.08)'};

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
function todayISO(){return window.isoDate ? window.isoDate(new Date()) : new Date().toISOString().slice(0,10);}
function tipoNorm(t){return String(t||'').toUpperCase().replace(/[^A-Z_]/g,'');}
function ensureDefaultPendingFromToday(){
  if(!_bajasState.dateStart && !_bajasState.dateEnd && _bajasState.estados.includes('pendiente') && _bajasState.estados.includes('activo') && _bajasState.estados.length === 2){
    _bajasState.dateStart = todayISO();
  }
}

// ── LOAD DATA ──
async function loadBajasData(){
  try{
    const raw=await window.TurnosDB.fetchBajasPermisos({estadoFiltro:'all'});
    _bajasData=(raw||[]).filter(ev=>{
      const t=tipoNorm(ev.tipo);
      return TIPOS_BAJA.some(x=>t.startsWith(x))||t.includes('BAJA')||t.includes('PERM');
    });
    return _bajasData;
  }catch(e){console.error('[BAJAS] Error cargando:',e);_bajasData=[];return[];}
}

// ── FILTER ──
function normEstado(v){return String(v||'').trim().toLowerCase()||'activo';}

function applyFilters(data){
  const s=_bajasState;
  const hoy=window.isoDate(new Date());

  return data.filter(ev=>{
    if(s.hotel!=='all'&&(ev.hotel_origen||ev.hotel_id||'')!==s.hotel)return false;
    if(s.empSearch){
      const txt=(ev.empleado_id||'')+(ev.empleado_nombre||'')+(ev.empleado_uuid||'');
      if(!txt.toLowerCase().includes(s.empSearch))return false;
    }
    if(s.tipo!=='all'){const t=tipoNorm(ev.tipo);if(!t.startsWith(s.tipo))return false;}
    if(_bajasState.estados.length > 0 && !_bajasState.estados.includes('all')){
      const rawEs=normEstado(ev.estado);
      const fin=ev.fecha_fin||ev.fecha_inicio;
      const displayEs=(fin<hoy&&rawEs!=='anulado'&&rawEs!=='rechazado')?'finalizado':rawEs;
      if(!_bajasState.estados.includes(displayEs))return false;
    }
    if(s.sustSearch){
      const txt=(ev.empleado_destino_id||'')+(ev.sustituto_nombre||'')+(ev.sustituto_id||'');
      if(!txt.toLowerCase().includes(s.sustSearch))return false;
    }
    if(s.noSust&&(ev.empleado_destino_id||ev.sustituto_id))return false;
    if(s.dateStart||s.dateEnd){
      const eStart=ev.fecha_inicio||'';const eEnd=ev.fecha_fin||eStart;
      const fs=s.dateStart||'0000-01-01';const fe=s.dateEnd||'9999-12-31';
      if(!(eStart<=fe&&eEnd>=fs))return false;
    }
    return true;
  });
}

// ── KPIs ──
function calcKPIs(groups){
  const hoy=window.isoDate(new Date());
  const d30=window.addIsoDays(hoy,30);
  let activas=0,pendientes=0,prox30=0,sinSust=0,dias=0;
  groups.forEach(g=>{
    const fin=g.fecha_fin||g.fecha_inicio;
    const rawEst=normEstado(g.estado);
    const est=(fin<hoy&&rawEst!=='anulado'&&rawEst!=='rechazado')?'finalizado':rawEst;
    if(est==='anulado'||est==='rechazado')return;
    if(g.fecha_inicio<=hoy&&fin>=hoy)activas++;
    if(est==='pendiente')pendientes++;
    if(g.fecha_inicio>=hoy&&g.fecha_inicio<=d30)prox30++;
    if(!g.empleado_destino_id&&!g.sustituto_id)sinSust++;
    dias+=diffDays(g.fecha_inicio,fin);
  });
  return{activas,pendientes,prox30,sinSust,total:groups.length,dias};
}

// ── RENDER ──
window.renderBajas=async()=>{
  const area=$('#absences-content');
  if(!area)return;
  
  const activeId = document.activeElement ? document.activeElement.id : null;
  const selStart = document.activeElement && document.activeElement.selectionStart !== undefined ? document.activeElement.selectionStart : null;
  const selEnd = document.activeElement && document.activeElement.selectionEnd !== undefined ? document.activeElement.selectionEnd : null;

  // Cache filter values from DOM BEFORE destroying with innerHTML
  // Skip if clearBajasFilters just set fresh values
  if (!_skipDomCache) {
    const _h=$('#bjHotel');if(_h)_bajasState.hotel=_h.value;
    const _e=$('#bjEmpSearch');if(_e)_bajasState.empSearch=_e.value.toLowerCase();
    const _t=$('#bjTipo');if(_t)_bajasState.tipo=_t.value;
    // (estados is handled immediately on change, no need to cache here)
    const _ss=$('#bjSustSearch');if(_ss)_bajasState.sustSearch=_ss.value.toLowerCase();
    const _ns=$('#bjNoSust');if(_ns)_bajasState.noSust=_ns.checked;
    const _ds=$('#bjDateStart');if(_ds)_bajasState.dateStart=_ds.value;
    const _de=$('#bjDateEnd');if(_de)_bajasState.dateEnd=_de.value;
  }
  _skipDomCache = false;
  ensureDefaultPendingFromToday();

  area.innerHTML='<div style="padding:3rem;text-align:center;opacity:0.5;">Cargando Bajas y Permisos...</div>';
  try{
    if(!_bajasInitialized){await loadBajasData();_bajasInitialized=true;}
    _bajasFiltered=applyFilters(_bajasData);
    _bajasGrouped=window.groupConsecutiveEvents(_bajasFiltered);
    _bajasGrouped.sort((a,b)=>(b.fecha_inicio||'').localeCompare(a.fecha_inicio||''));
    const emps=window.empleadosGlobales||await window.TurnosDB.getEmpleados();
    const hotels=await window.getAvailableHotels();
    const kpi=calcKPIs(_bajasGrouped);
    const fH=_bajasState.hotel;
    const fT=_bajasState.tipo;
    const fE=_bajasState.estados;

    area.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:16px;">
      ${[['Activas ahora',kpi.activas,'#10b981'],['Pendientes',kpi.pendientes,'#f59e0b'],['Próx. 30 días',kpi.prox30,'#3b82f6'],['Sin sustituto',kpi.sinSust,'#ef4444'],['Total filtrado',kpi.total,'var(--text)'],['Días naturales',kpi.dias,'var(--text)']].map(([l,v,c])=>`
      <div class="glass-panel" style="padding:14px;border:1px solid var(--border);border-radius:14px;">
        <div style="font-size:0.65rem;color:var(--text-dim);font-weight:800;text-transform:uppercase;">${l}</div>
        <div style="font-size:1.6rem;font-weight:900;margin-top:4px;color:${c};">${v}</div>
      </div>`).join('')}
    </div>
    <div class="glass-panel" style="padding:15px; border:1px solid var(--border); border-radius:14px; margin-bottom:16px; background: var(--bg3);">
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <div class="glass-panel" style="display:flex; gap:0; border:1px solid var(--border); border-radius:10px; overflow:hidden; background:var(--bg); height:34px;">
          <input type="date" id="bjDateStart" class="btn-premium" style="width:130px; border:none; background:transparent; font-size:0.75rem; padding:0 8px; margin:0;" value="${_bajasState.dateStart||''}" onchange="window.renderBajas()">
          <div style="width:1px; background:var(--border);"></div>
          <input type="date" id="bjDateEnd" class="btn-premium" style="width:130px; border:none; background:transparent; font-size:0.75rem; padding:0 8px; margin:0;" value="${_bajasState.dateEnd||''}" onchange="window.renderBajas()">
        </div>

        <select id="bjHotel" class="btn-premium" onchange="window.renderBajas()" style="height:34px; padding:0 12px; font-size:0.75rem;">
          <option value="all">Todos los hoteles</option>
          ${hotels.map(h=>`<option value="${h}"${fH===h?' selected':''}>${h}</option>`).join('')}
        </select>

        <div class="glass-panel" style="display:flex; gap:0; border:1px solid var(--border); border-radius:10px; background:var(--bg); height:34px;">
          <input type="text" id="bjEmpSearch" class="btn-premium" placeholder="🔍 Empleado / ID..." style="width:160px; border:none; background:transparent; font-size:0.75rem; padding:0 10px; margin:0;" value="${_bajasState.empSearch||''}" oninput="window.renderBajas()">
          <div style="width:1px; background:var(--border);"></div>
          <select id="bjTipo" class="btn-premium" onchange="window.renderBajas()" style="border:none; background:transparent; font-size:0.75rem; padding:0 10px; margin:0; cursor:pointer;">
            <option value="all">Todos los tipos</option>
            <option value="BAJA"${fT==='BAJA'?' selected':''}>Baja Médica / IT</option>
            <option value="PERM"${fT==='PERM'?' selected':''}>Permiso</option>
            <option value="FORMACION"${fT==='FORMACION'?' selected':''}>Formación</option>
            <option value="OTRO"${fT==='OTRO'?' selected':''}>Otro</option>
          </select>
          <div class="custom-dropdown" style="position:relative;" id="bjEstadoDropdownContainer">
            <button class="btn-premium" onclick="document.getElementById('bjEstadoOptions').style.display=document.getElementById('bjEstadoOptions').style.display==='block'?'none':'block';event.stopPropagation();" style="border:none; background:transparent; font-size:0.75rem; padding:0 10px; margin:0; cursor:pointer; height:34px;">
              ${fE.includes('all') ? 'Todos los estados ▾' : fE.length + ' estados ▾'}
            </button>
            <div id="bjEstadoOptions" onclick="event.stopPropagation()" style="display:none; position:absolute; top:100%; left:-20px; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:8px; z-index:999; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); width:140px; margin-top:4px;">
              ${['pendiente','activo','aprobado','rechazado','anulado','finalizado'].map(est => `
                  <label style="display:block; padding:4px 8px; font-size:0.75rem; cursor:pointer; border-radius:6px; margin-bottom:2px;" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">
                      <input type="checkbox" value="${est}" ${fE.includes(est) || fE.includes('all') ? 'checked' : ''} onchange="window.updateBjEstados(this)"> ${est.charAt(0).toUpperCase() + est.slice(1)}
                  </label>
              `).join('')}
            </div>
          </div>
        </div>

        <input type="text" id="bjSustSearch" class="btn-premium" placeholder="🔍 Sustituto..." style="width:140px; height:34px; font-size:0.75rem; padding:0 12px;" value="${_bajasState.sustSearch||''}" oninput="window.renderBajas()">
        
        <label style="display:flex; align-items:center; gap:6px; font-size:0.7rem; font-weight:700; color:var(--text-dim); cursor:pointer; background:var(--bg3); padding:8px 12px; border-radius:10px; border:1px solid var(--border);">
          <input type="checkbox" id="bjNoSust" ${_bajasState.noSust?'checked':''} onchange="window.renderBajas()"> Sin sustituto
        </label>

        <div style="margin-left:auto; display:flex; gap:6px;">
          <button class="btn-premium" onclick="window.clearBajasFilters()" style="padding:0 12px; height:34px; font-size:0.7rem; font-weight:700; border-radius:10px;">✕ Limpiar</button>
          <button class="btn-premium" onclick="window.refreshBajas()" style="padding:0 12px; height:34px; font-size:0.7rem; font-weight:700; border-radius:10px;">↻ Refrescar</button>
        </div>
      </div>
    </div>
    ${_bajasGrouped.length===0?`<div style="padding:3rem;text-align:center;color:var(--text-dim);font-size:0.9rem;">No hay registros para los filtros actuales.</div>`:`
    <div class="glass-panel" style="padding:0;overflow:hidden;border-radius:15px;border:1px solid var(--border);">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:var(--bg3);">
          ${['Tipo','Empleado','Hotel','Periodo / Duración','Sustituto','Estado','Obs.','Acciones'].map(h=>`<th style="padding:12px;text-align:left;font-size:0.65rem;color:var(--text-dim);text-transform:uppercase;font-weight:800;">${h}</th>`).join('')}
        </tr></thead>
        <tbody>${_bajasGrouped.map((b,i)=>{
          const tn=tipoNorm(b.tipo);const fin=b.fecha_fin||b.fecha_inicio;const d=diffDays(b.fecha_inicio,fin);
          const sameDay=b.fecha_inicio===fin;
          const rawEst=normEstado(b.estado);
          const hoyStr=window.isoDate(new Date());
          const est=(fin<hoyStr&&rawEst!=='anulado'&&rawEst!=='rechazado')?'finalizado':rawEst;
          const sustTxt=b.empleado_destino_id?empLabel(b.empleado_destino_id,emps):(b.sustituto_id?empLabel(b.sustituto_id,emps):null);
          const obs=b.observaciones||b.motivo||'';
          return`<tr style="border-top:1px solid var(--border);">
            <td style="padding:12px;"><span style="background:${TIPO_BG[tn]||TIPO_BG.OTRO};color:${TIPO_COLOR[tn]||TIPO_COLOR.OTRO};padding:4px 10px;border-radius:8px;font-weight:800;font-size:0.6rem;white-space:nowrap;">${TIPO_LABEL[tn]||b.tipo}</span></td>
            <td style="padding:12px;font-weight:700;">${empLabel(b.empleado_id,emps)}</td>
            <td style="padding:12px;font-size:0.85rem;color:var(--text-dim);">${b.hotel_origen||b.hotel_id||'General'}</td>
            <td style="padding:12px;text-align:center;">
              <div style="font-weight:600;">${sameDay?fmtD(b.fecha_inicio):`${fmtD(b.fecha_inicio)} — ${fmtD(fin)}`}</div>
              <div style="font-size:0.6rem;color:var(--text-dim);margin-top:3px;font-weight:700;">${d} día${d!==1?'s':''} natural${d!==1?'es':''}${b.isGroup?' (agrupados)':''}</div>
            </td>
            <td style="padding:12px;font-size:0.85rem;">${sustTxt||'<span style="color:#f59e0b;font-weight:700;font-size:0.75rem;">Sin sustituto</span>'}</td>
            <td style="padding:12px;text-align:center;"><span style="background:${ESTADO_BG[est]||ESTADO_BG.activo};color:${ESTADO_COLOR[est]||ESTADO_COLOR.activo};padding:4px 10px;border-radius:8px;font-weight:800;font-size:0.6rem;">${est.toUpperCase()}</span></td>
            <td style="padding:12px;font-size:0.75rem;color:var(--text-dim);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${window.escapeHtml(obs)}">${obs?window.escapeHtml(obs.slice(0,40)):'—'}</td>
            <td style="padding:12px;text-align:center;white-space:nowrap;">
              <button class="btn-premium" onclick="window.manageBajaPermisoGroup(${i})" style="padding:5px 10px;font-size:0.65rem;margin:2px;">Gestionar</button>
              ${est!=='anulado'?`<button class="btn-premium" onclick="window.cancelBajaPermisoGroup(${i})" style="padding:5px 10px;font-size:0.65rem;color:var(--danger);margin:2px;">Anular</button>`:''}
            </td>
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>`}`;
  }catch(e){
    console.error('[BAJAS] Render error:',e);
    area.innerHTML=`<div style="padding:2rem;color:var(--danger);"><strong>Error cargando Bajas y Permisos:</strong> ${e.message}<br><pre style="font-size:0.7rem;margin-top:8px;opacity:0.7;">${e.stack||''}</pre></div>`;
  }
  
  if (activeId) {
      setTimeout(() => {
          const el = document.getElementById(activeId);
          if (el) {
              el.focus();
              if (el.setSelectionRange && selStart !== null && selStart !== undefined) {
                  el.setSelectionRange(selStart, selEnd);
              }
          }
      }, 10);
  }
};

// ── MODAL OPEN ──
window.openBajaPermisoModal=async(editData)=>{
  _editingBaja=editData||null;
  const m=$('#modalBaja');if(!m)return;
  const [hotels,allEmps]=await Promise.all([window.getAvailableHotels(),window.TurnosDB.getEmpleados()]);
  const emps = (allEmps || []).filter(e => !window.isEmployeeTerminated(e));
  $('#mbHotel').innerHTML='<option value="" disabled selected>Seleccionar hotel...</option>'+hotels.map(h=>`<option value="${h}"${_editingBaja&&_editingBaja.hotel_origen===h?' selected':''}>${h}</option>`).join('');
  $('#mbEmp').innerHTML='<option value="" disabled selected>Seleccionar empleado...</option>'+emps.map(e=>`<option value="${e.id}"${_editingBaja&&_editingBaja.empleado_id===e.id?' selected':''}>${e.nombre||e.id}${e.id_interno?' ['+e.id_interno+']':''}</option>`).join('');
  $('#mbSustituto').innerHTML='<option value="">Sin sustituto asignado</option>'+emps.map(e=>`<option value="${e.id}"${_editingBaja&&(_editingBaja.empleado_destino_id===e.id||_editingBaja.sustituto_id===e.id)?' selected':''}>${e.nombre||e.id}${e.id_interno?' ['+e.id_interno+']':''}</option>`).join('');
  if(_editingBaja){
    $('#modalBajaTitle').textContent='Gestionar Baja / Permiso';
    $('#mbTipo').value=_editingBaja.tipo||'BAJA';
    $('#mbDateStart').value=_editingBaja.fecha_inicio||'';
    $('#mbDateEnd').value=_editingBaja.fecha_fin||_editingBaja.fecha_inicio||'';
    $('#mbEstado').value=(_editingBaja.estado||'activo').toLowerCase();
    $('#mbObs').value=_editingBaja.observaciones||'';
    $('#btnAnularBaja').style.display='block';
  }else{
    $('#modalBajaTitle').textContent='Añadir Baja o Permiso';
    $('#mbTipo').value='BAJA';$('#mbDateStart').value='';$('#mbDateEnd').value='';
    $('#mbEstado').value='activo';$('#mbObs').value='';
    $('#btnAnularBaja').style.display='none';
  }
  $('#modalBajaStatus').innerHTML='';$('#modalBajaWarning').style.display='none';
  m.style.display='flex'; setTimeout(()=>m.classList.add('open'),10);
};

// ── MODAL CLOSE ──
window.closeBajaPermisoModal=()=>{
  _editingBaja=null;
  const m=$('#modalBaja');if(m){m.classList.remove('open');setTimeout(()=>m.style.display='none',300);}
};

// ── SAVE ──
window.saveBajaPermiso=async()=>{
  const btn=$('#btnSaveBajaPermiso');const status=$('#modalBajaStatus');const warn=$('#modalBajaWarning');
  const tipo=$('#mbTipo').value;const hotel=$('#mbHotel').value;const empId=$('#mbEmp').value;
  const start=$('#mbDateStart').value;const end=$('#mbDateEnd').value;
  const sustId=$('#mbSustituto').value;const estado=$('#mbEstado').value;const obs=$('#mbObs').value;
  // Validations
  if(!tipo){status.innerHTML='<span style="color:var(--danger);">Tipo obligatorio.</span>';return;}
  if(!empId){status.innerHTML='<span style="color:var(--danger);">Empleado obligatorio.</span>';return;}
  if(!hotel){status.innerHTML='<span style="color:var(--danger);">Hotel obligatorio.</span>';return;}
  if(!start){status.innerHTML='<span style="color:var(--danger);">Fecha inicio obligatoria.</span>';return;}
  if(!end){status.innerHTML='<span style="color:var(--danger);">Fecha fin obligatoria.</span>';return;}
  if(end<start){status.innerHTML='<span style="color:var(--danger);">Fecha fin no puede ser anterior a inicio.</span>';return;}
  if(sustId&&sustId===empId){status.innerHTML='<span style="color:var(--danger);">El sustituto no puede ser el mismo empleado.</span>';return;}
  if(!sustId){warn.textContent='⚠ Este periodo deja turnos sin cobertura (sin sustituto).';warn.style.display='block';}
  try{
    btn.disabled=true;btn.textContent='Guardando...';
    if(_editingBaja&&_editingBaja.id){
      // Update existing
      await window.TurnosDB.upsertEvento({id:_editingBaja.id,tipo,empleado_id:empId,hotel_origen:hotel,fecha_inicio:start,fecha_fin:end,empleado_destino_id:sustId||null,estado,observaciones:obs,payload:{tipo_modulo:'bajas_permisos',creado_desde:'admin_bajas_permisos'}});
    }else{
      // Create new
      await window.TurnosDB.upsertEvento({tipo,empleado_id:empId,hotel_origen:hotel,fecha_inicio:start,fecha_fin:end,empleado_destino_id:sustId||null,estado,observaciones:obs,payload:{tipo_modulo:'bajas_permisos',creado_desde:'admin_bajas_permisos'}});
    }
    status.innerHTML='<span style="color:#10b981;">✓ Guardado correctamente</span>';
    if(window.addLog)window.addLog(`Baja/Permiso ${_editingBaja?'actualizado':'creado'}: ${tipo} - ${empId}`,'info');
    _bajasInitialized=false;
    setTimeout(()=>{window.closeBajaPermisoModal();window.renderBajas();},800);
  }catch(e){
    status.innerHTML=`<span style="color:var(--danger);">Error: ${e.message}</span>`;
  }finally{btn.disabled=false;btn.textContent=_editingBaja?'Actualizar':'Guardar';}
};

// ── MANAGE GROUP ──
window.manageBajaPermisoGroup=async(idx)=>{
  const g=_bajasGrouped[idx];if(!g)return;
  if(g.isGroup&&g.ids&&g.ids.length>1){
    // Fetch first event for full data
    try{
      const allEvts=await window.TurnosDB.fetchEventos();
      const match=allEvts.find(e=>String(e.id)===String(g.id));
      if(match){window.openBajaPermisoModal({...match,fecha_fin:g.fecha_fin,_groupIds:g.ids,_groupCount:g.ids.length});}
      else{window.openBajaPermisoModal(g);}
    }catch(e){window.openBajaPermisoModal(g);}
  }else{
    try{
      const allEvts=await window.TurnosDB.fetchEventos();
      const match=allEvts.find(e=>String(e.id)===String(g.id));
      window.openBajaPermisoModal(match||g);
    }catch(e){window.openBajaPermisoModal(g);}
  }
};

// ── CANCEL/ANULAR GROUP ──
window.cancelBajaPermisoGroup=async(idx)=>{
  const g=_bajasGrouped[idx];if(!g)return;
  const emps=window.empleadosGlobales||[];
  const d=diffDays(g.fecha_inicio,g.fecha_fin||g.fecha_inicio);
  const label=empLabel(g.empleado_id,emps);
  const msg=`Vas a anular ${d} día${d!==1?'s':''} de ${TIPO_LABEL[tipoNorm(g.tipo)]||g.tipo} de ${label} del ${fmtD(g.fecha_inicio)} al ${fmtD(g.fecha_fin||g.fecha_inicio)}.\n\n¿Continuar?`;
  if(!confirm(msg))return;
  try{
    const ids=g.ids||[g.id];
    for(const id of ids){await window.TurnosDB.anularBajaPermiso(id,'Anulado desde módulo Bajas/Permisos');}
    if(window.addLog)window.addLog(`Baja/Permiso anulado: ${g.tipo} - ${g.empleado_id} (${ids.length} eventos)`,'warn');
    _bajasInitialized=false;await window.renderBajas();
  }catch(e){alert('Error al anular: '+e.message);}
};

// ── ANULAR FROM MODAL ──
window.anularBajaPermisoAction=async()=>{
  if(!_editingBaja)return;
  const ids=_editingBaja._groupIds||[_editingBaja.id];
  const d=diffDays(_editingBaja.fecha_inicio,_editingBaja.fecha_fin||_editingBaja.fecha_inicio);
  const msg=`Vas a anular ${d} día${d!==1?'s':''} de ${_editingBaja.tipo} de ${_editingBaja.empleado_id}.\n\n¿Continuar?`;
  if(!confirm(msg))return;
  try{
    for(const id of ids){await window.TurnosDB.anularBajaPermiso(id,'Anulado desde modal Bajas/Permisos');}
    if(window.addLog)window.addLog(`Baja/Permiso anulado desde modal: ${_editingBaja.tipo}`,'warn');
    _bajasInitialized=false;window.closeBajaPermisoModal();await window.renderBajas();
  }catch(e){alert('Error: '+e.message);}
};

// ── CLEAR FILTERS ──
window.clearBajasFilters=()=>{
  // Reset persistent state to defaults (estado defaults to pendiente/activo)
  _bajasState.hotel='all';_bajasState.empSearch='';_bajasState.tipo='all';
  _bajasState.estados=['pendiente','activo'];_bajasState.sustSearch='';_bajasState.noSust=false;
  _bajasState.dateStart=todayISO();_bajasState.dateEnd='';
  _skipDomCache = true;
  window.renderBajas();
};

// Multi-select updates
window.updateBjEstados = (cb) => {
    if(cb.value === 'all') {
        _bajasState.estados = ['all'];
    } else {
        if(_bajasState.estados.includes('all')) _bajasState.estados = [];
        if(cb.checked) {
            if(!_bajasState.estados.includes(cb.value)) _bajasState.estados.push(cb.value);
        } else {
            _bajasState.estados = _bajasState.estados.filter(e => e !== cb.value);
        }
        if(_bajasState.estados.length === 0) _bajasState.estados = ['all'];
    }
    _skipDomCache = true;
    window.renderBajas();
    // Reopen dropdown to simulate not closing it
    setTimeout(() => {
        const opts = document.getElementById('bjEstadoOptions');
        if(opts) opts.style.display = 'block';
    }, 10);
};

if(!window._bjClickOutsideInstalled) {
    window._bjClickOutsideInstalled = true;
    document.addEventListener('click', (e) => {
        const drop = document.getElementById('bjEstadoOptions');
        const btn = document.querySelector('#bjEstadoDropdownContainer button');
        if(drop && drop.style.display === 'block' && !drop.contains(e.target) && (!btn || !btn.contains(e.target))) {
            drop.style.display = 'none';
        }
    });
}

// ── REFRESH ──
window.refreshBajas=async()=>{_bajasInitialized=false;await window.renderBajas();};

// ── COMPAT: old manageBajaGroup calls ──
window.manageBajaGroup=window.manageBajaPermisoGroup;

console.log('[BAJAS MODULE] Loaded v1.1');
})();
