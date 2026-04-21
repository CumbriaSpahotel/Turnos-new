/* mobile.app.js (V9.8 Premium Glassmorphism) */
(function () {
  const $  = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  const pad = n => String(n).padStart(2, "0");
  const weekdayShort = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

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

  function getLabel(item) {
    if (!item) return "";
    const t = (item.turno || '').toLowerCase();
    const tipo = (item.tipo || '').toUpperCase();
    if (tipo.startsWith('VAC')) return 'Vacaciones';
    if (tipo.startsWith('BAJA')) return 'Baja';
    if (tipo.startsWith('PERM')) return 'Permiso';
    if (t.startsWith('m')) return 'Mañana';
    if (t.startsWith('t')) return 'Tarde';
    if (t.startsWith('n')) return 'Noche';
    if (t.startsWith('d')) return 'Descanso';
    return item.turno;
  }

  function getClass(item) {
    if (!item) return '';
    const t = (item.turno || '').toLowerCase();
    const tipo = (item.tipo || '').toUpperCase();
    if (tipo.startsWith('VAC')) return 'v';
    if (tipo.startsWith('BAJA') || tipo.startsWith('PERM')) return 'd';
    if (t.startsWith('m')) return 'm';
    if (t.startsWith('t')) return 't';
    if (t.startsWith('n')) return 'n';
    if (t.startsWith('d')) return 'd';
    return '';
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

  const EXCEL_SOURCE_FILE = 'Plantilla%20Cuadrante%20Turnos%20v.8.0.xlsx';
  const EXCEL_HOTEL_SHEETS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

  async function loadExcelSourceRows() {
    if (window._excelSourceRows) return window._excelSourceRows;
    try {
        const response = await fetch(EXCEL_SOURCE_FILE, { cache: 'no-store' });
        if (!response.ok) return {};
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const result = {};
        EXCEL_HOTEL_SHEETS.forEach(hotel => {
            const sheet = workbook.Sheets[hotel];
            if (!sheet) return;
            const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
            result[hotel] = matrix.slice(1).map(row => ({
                hotel,
                weekStart: row[0] instanceof Date ? row[0].toISOString().split('T')[0] : (typeof row[0] === 'string' ? row[0].split('T')[0] : ''),
                empleadoId: String(row[1] || '').trim(),
                values: [0,1,2,3,4,5,6].map(i => {
                    const val = String(row[i+2]||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                    if (val.startsWith('m')) return 'M';
                    if (val.startsWith('t')) return 'T';
                    if (val.startsWith('n')) return 'N';
                    if (val.startsWith('d')) return 'D';
                    return String(row[i+2]||'').trim();
                })
            })).filter(r => r.weekStart && r.empleadoId);
        });
        window._excelSourceRows = result;
        return result;
    } catch(e) { 
        console.warn("Excel no disponible (CORS/Network)"); 
        return {}; 
    }
  }

  window.refreshMobileView = async function() {
    const data = window.FULL_DATA || { flat: [] };
    const excelSource = await loadExcelSourceRows();
    data.excelSource = excelSource;

    const hotels = Array.from(new Set(data.flat.map(t => t.hotel_id))).filter(Boolean).sort();
    
    if (hotelSelect && hotelSelect.options.length <= 1) {
        const currentHotel = hotelSelect.value || "";
        hotelSelect.innerHTML = `<option value="">Todos los Hoteles</option>` +
            hotels.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join("");
        hotelSelect.value = hotels.includes(currentHotel) ? currentHotel : "";
    }

    if (dateInput && !dateInput.value) {
        dateInput.value = toISODateUTC(mondayOf(new Date()));
    }

    const hotelVal = hotelSelect ? hotelSelect.value : "";
    const monday   = new Date((dateInput ? dateInput.value : toISODateUTC(new Date())) + "T12:00:00");

    shiftGrid.innerHTML = "";

    if (!hotels.length && data.flat.length === 0) {
      shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.5">No hay turnos para esta semana.</div>`;
      return;
    }

    const hotelsToRender = hotelVal ? [hotelVal] : (hotels.length ? hotels : ['Cumbria Spa&Hotel', 'Sercotel Guadiana']);

    for (const h of hotelsToRender) {
        await renderTable(h, monday, data, shiftGrid);
    }
  };

  async function renderTable(hotel, monday, data, container) {
    const weekData = window.MobileAdapter.buildWeekData(data, hotel, monday, window.PROFILES || []);
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
                <div class="grid-th th-emp">Empleado</div>
                ${dates.map((d, i) => {
                    const dayObj = new Date(d + 'T12:00:00');
                    return `<div class="grid-th">${weekdayShort[i]}<br><span style="opacity:0.6">${dayObj.getUTCDate()}</span></div>`;
                }).join('')}
            </div>
            <div class="grid-body">
                ${(weekData.empDetailed || []).map(entry => {
                    const { id: emp, isAbsent: empIsAbsent } = entry;
                    const shifts = weekData.turnosByEmpleado[emp] || {};
                    const n = Object.values(shifts).filter(s => (s.turno||'').toLowerCase().startsWith('n')).length;
                    const dCount = Object.values(shifts).filter(s => (s.turno||'').toLowerCase().startsWith('d')).length;

                    return `
                        <div class="grid-row" style="${empIsAbsent ? 'opacity:0.45; background:var(--bg);' : ''}">
                            <div class="name-sticky" style="${empIsAbsent ? 'text-decoration:line-through; color:var(--muted);' : ''}">
                                ${escapeHtml(emp)}
                                <div class="stats">
                                    <span>🌙 ${n}</span> • <span>D ${dCount}</span>
                                </div>
                            </div>
                            ${dates.map(dKey => {
                                const item = shifts[dKey];
                                if (!item) return `<div class="grid-cell"></div>`;
                                const cls = getClass(item);
                                const lab = getLabel(item);
                                return `<div class="grid-cell">
                                    <span class="badge-shift ${cls}">${escapeHtml(lab)}</span>
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
    if (!dateInput) return;
    const d = new Date(dateInput.value + "T12:00:00");
    d.setDate(d.getDate() + (delta * 7));
    dateInput.value = toISODateUTC(mondayOf(d));
    window.refreshMobileView();
  };

  window.initMobileSunc = async function() {
    // Initial fetch handled by supabase-dao/adapter? 
    // Usually FULL_DATA is populated before this.
    await window.refreshMobileView();
  };

})();
