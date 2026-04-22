/* mobile.app.js (V3.1 Premium - Admin Standard) */
(function () {
  const $  = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  const pad = n => String(n).padStart(2, "0");
  const weekdayLong = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
  const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  function mondayOf(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }

  function toISODateUTC(date) {
    return [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())].join("-");
  }

  function addDays(date, n) {
    const d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  }

  function logoFor(hotel) {
    if ((hotel || "").toLowerCase().includes("guadiana")) return "guadiana logo.jpg";
    return "cumbria logo.jpg";
  }

  function getDisplayInfo(item) {
    if (!item) return { label: '·', cls: 'empty', icon: '', title: '' };
    const visual = window.TurnosRules.describeCell(item);
    let label = visual.label || item.turno || '·';
    if (visual.key === 'v') label = 'Vac';
    return {
      label: label,
      cls: visual.mobileClass,
      icon: visual.icon || '',
      title: visual.title || ''
    };
  }

  const dateInput   = $("#dateInput");
  const hotelSelect = $("#hotelSelect");
  const shiftGrid   = $("#shiftGrid");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  async function loadExcelSourceRows() {
    if (window._excelSourceRows) return window._excelSourceRows;
    try {
        const response = await fetch('Plantilla%20Cuadrante%20Turnos%20v.8.0.xlsx', { cache: 'no-store' });
        if (!response.ok) return {};
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const result = {};
        ['Cumbria Spa&Hotel', 'Sercotel Guadiana'].forEach(hotel => {
            const sheet = workbook.Sheets[hotel];
            if (!sheet) return;
            const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
            result[hotel] = matrix.slice(1).map(row => ({
                hotel,
                weekStart: row[0] instanceof Date ? row[0].toISOString().split('T')[0] : (typeof row[0] === 'string' ? row[0].split('T')[0] : ''),
                empleadoId: String(row[1] || '').trim(),
                values: [0,1,2,3,4,5,6].map(i => String(row[i+2]||'').trim())
            })).filter(r => r.weekStart && r.empleadoId);
        });
        window._excelSourceRows = result;
        return result;
    } catch(e) { 
        return {}; 
    }
  }

  window.refreshMobileView = async function() {
    if (!dateInput.value) {
        dateInput.value = toISODateUTC(mondayOf(new Date()));
    }

    const startIso = dateInput.value;
    const dEnd = new Date(startIso + "T12:00:00");
    dEnd.setDate(dEnd.getDate() + 6);
    const endIso = toISODateUTC(dEnd);

    shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.5; font-weight:700;">Sincronizando...</div>`;
    
    let flatData = [];
    try {
        flatData = await window.TurnosDB.fetchRangoCalculado(startIso, endIso) || [];
    } catch(e) { 
        try { flatData = await window.TurnosDB.fetchRango(startIso, endIso) || []; } catch(e2){}
    }
    
    const excelSource = await loadExcelSourceRows();
    const profiles = await window.TurnosDB.getEmpleados();
    const data = { flat: flatData, excelSource };

    const hotels = Array.from(new Set(flatData.map(t => t.hotel_id))).filter(Boolean).sort();
    if (hotelSelect && hotelSelect.options.length <= 1) {
        const currentHotel = hotelSelect.value || "";
        hotelSelect.innerHTML = `<option value="">Todos los Hoteles</option>` +
            hotels.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join("");
        hotelSelect.value = hotels.includes(currentHotel) ? currentHotel : "";
    }

    const hotelVal = hotelSelect.value || "";
    const mondayD = new Date(startIso + "T12:00:00");
    shiftGrid.innerHTML = "";

    const hotelsToRender = hotelVal ? [hotelVal] : (hotels.length ? hotels : ['Cumbria Spa&Hotel', 'Sercotel Guadiana']);
    for (const h of hotelsToRender) {
        await renderTable(h, mondayD, data, shiftGrid, profiles);
    }
    
    if (shiftGrid.innerHTML === "") {
        shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.5; color:var(--muted);">No hay turnos registrados en la nube.</div>`;
    }
  };

  async function renderTable(hotel, monday, data, container, profiles) {
    const FULL_DATA = { flat: data.flat, excelSource: data.excelSource };
    const weekData = window.MobileAdapter.buildWeekData(FULL_DATA, hotel, monday, profiles);
    if (!weekData || !weekData.empDetailed || weekData.empDetailed.length === 0) return;

    const baseMonday = weekData.monday;
    const dates = [0,1,2,3,4,5,6].map(i => toISODateUTC(addDays(baseMonday, i)));

    const section = document.createElement("div");
    section.className = "hotel-card";
    
    section.innerHTML = `
        <div class="hotel-info">
            <img src="${escapeHtml(logoFor(hotel))}" alt="">
            <h2>${escapeHtml(hotel)}</h2>
        </div>
        <div class="table-wrapper">
            <div class="grid-head">
                <div class="grid-th th-emp" style="font-size:0.7rem; color:var(--muted); text-transform:uppercase;">EMPLEADO</div>
                ${dates.map((d, i) => {
                    const dayObj = new Date(d + 'T12:00:00');
                    const dayLabel = `${dayObj.getUTCDate()}/${monthNames[dayObj.getUTCMonth()]}/${dayObj.getUTCFullYear().toString().slice(-2)}`;
                    return `<div class="grid-th">
                        <span>${weekdayLong[dayObj.getUTCDay()]}</span><br>
                        <span style="opacity:0.6; font-size:0.75rem; font-weight:500;">${dayLabel}</span>
                    </div>`;
                }).join('')}
            </div>
            <div class="grid-body">
                ${(weekData.empDetailed || []).map(entry => {
                    const { id: emp, isAbsent: empIsAbsent } = entry;
                    const shifts = weekData.turnosByEmpleado[emp] || {};
                    
                    let n = 0, dCount = 0;
                    Object.values(shifts).forEach(s => {
                        const t = (s.turno||'').toLowerCase();
                        if (t.startsWith('n')) n++;
                        if (t.startsWith('d')) dCount++;
                    });

                    return `
                        <div class="grid-row" style="${empIsAbsent ? 'opacity:0.5;' : ''}">
                            <div class="name-sticky">
                                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text); font-family:'Outfit', sans-serif; font-weight:600; font-size:0.8rem; letter-spacing:0.01em; text-transform:uppercase;">${escapeHtml(emp)}</span>
                                <div class="stats" style="display:flex; gap:5px; margin-top:3px;">
                                    <span style="background:rgba(0,0,0,0.04); color:var(--text); padding:1px 5px; border-radius:5px; font-size:0.62rem; font-weight:700; border:1px solid rgba(0,0,0,0.05); display:flex; align-items:center; gap:3px;">
                                        🌙 <span style="color:var(--text);">${n}</span>
                                    </span>
                                    <span style="background:rgba(239,68,68,0.05); padding:1px 5px; border-radius:5px; font-size:0.62rem; font-weight:700; border:1px solid rgba(239,68,68,0.1); display:flex; align-items:center; gap:3px;">
                                        <span style="color:#ef4444;">D</span> <span style="color:var(--text);">${dCount}</span>
                                    </span>
                                </div>
                            </div>
                            ${dates.map(dKey => {
                                const item = shifts[dKey];
                                const { label, cls, icon, title } = getDisplayInfo(item);
                                return `<div class="grid-cell" title="${escapeHtml(title || '')}">
                                    <span class="badge-shift ${cls}">${escapeHtml(label)}${icon ? ` ${icon}` : ''}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    container.appendChild(section);
  }

  window.changeWeek = function(delta) {
    const d = new Date(dateInput.value + "T12:00:00");
    d.setDate(d.getDate() + (delta * 7));
    dateInput.value = toISODateUTC(mondayOf(d));
    window.refreshMobileView();
  };

  window.initMobileSunc = async function() { await window.refreshMobileView(); };
})();
