/* mobile.app.js (V3.2 Premium - Admin Standard) */
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

  function logoFor(hotel) {
    if ((hotel || "").toLowerCase().includes("guadiana")) return "guadiana logo.jpg";
    return "cumbria logo.jpg";
  }

  /**
   * Helper visual compartido para vista pública/móvil
   */


  function getDisplayInfo(item) {
    if (!item) return { label: '·', cls: 'empty', icon: '', title: '' };
    const display = window.TurnosRules.getPublicCellDisplay(item, { compact: true });
    const visual = window.TurnosRules.describeCell(item);
    return {
      label: display.text,
      cls: visual.mobileClass,
      icon: '',
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

  // Mapa de hoteles para vincular selector y datos internos
  const HOTEL_MAP = {
    "cumbria":  { dataName: "CUMBRIA SPA&HOTEL", label: "Hotel Cumbria" },
    "guadiana": { dataName: "SERCOTEL GUADIANA",  label: "Sercotel Guadiana" }
  };

  window.refreshMobileView = async function() {
    if (!dateInput.value) {
        dateInput.value = toISODateUTC(mondayOf(new Date()));
    }
    const startIso = dateInput.value;
    const dEnd = new Date(startIso + "T12:00:00");
    dEnd.setDate(dEnd.getDate() + 6);
    const endIso = toISODateUTC(dEnd);

    // Actualizar etiqueta del selector con el nombre amigable
    const selectedId = hotelSelect.value;
    const hotelInfo = HOTEL_MAP[selectedId];
    if (hotelSelect.options[0]) {
        hotelSelect.options[0].text = hotelInfo ? `🏨 ${hotelInfo.label}` : "🏨 SELECCIONAR HOTEL";
    }

    shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.5; font-weight:700;">Cargando publicación...</div>`;
    
    try {
        const result = await window.TurnosDB.loadPublishedSchedule({
            semanaInicio: startIso,
            semanaFin: endIso,
            hotel: hotelInfo ? hotelInfo.dataName : null
        });

        if (!result.ok) {
            shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.6; color:var(--muted); font-weight:600;"><div style="font-size:2.5rem; margin-bottom:10px;">📅</div>${result.message}</div>`;
            return;
        }

        shiftGrid.innerHTML = "";
        // Función de orden estable de hoteles
        const getHotelOrder = (h) => {
            const n = (h || "").toLowerCase();
            if (n.includes("cumbria")) return 1;
            if (n.includes("guadiana")) return 2;
            return 999;
        };

        // Ordenar snapshots antes de renderizar
        const snapshots = (result.snapshots || []).sort((a, b) => {
            const orderA = getHotelOrder(a.hotel);
            const orderB = getHotelOrder(b.hotel);
            if (orderA !== orderB) return orderA - orderB;
            return (a.semana_inicio || "").localeCompare(b.semana_inicio || "");
        });

        for (const snap of snapshots) {
            if (hotelInfo) {
                // Normalización para evitar fallos por mayúsculas o espacios
                const normSnap = (snap.hotel || "").trim().toUpperCase();
                const normTarget = hotelInfo.dataName.trim().toUpperCase();
                if (normSnap !== normTarget) continue;
            }
            await renderSnapshotTable(snap.hotel, snap.data, shiftGrid);
        }

        if (shiftGrid.innerHTML === "") {
            const msg = hotelInfo 
                ? `No hay turnos cargados para ${hotelInfo.label} en esta semana.`
                : "No hay cuadrantes publicados para esta semana.";
            shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.5; color:var(--muted); font-weight:600;">${msg}</div>`;
        }
    } catch(e) { 
        console.error("Error en vista móvil:", e);
        shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; color:#ef4444; font-weight:700;">Error de conexión. Por favor, reintente.</div>`;
    }
  };

  function formatShiftText(text) {
    if (!text) return "";
    // Regex para detectar emojis comunes en los turnos
    const emojiRegex = /([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/gu;
    return escapeHtml(text).replace(emojiRegex, '<span class="emoji-indicator">$1</span>');
  }

  async function renderSnapshotTable(hotel, snapshotData, container) {
    const empleados = snapshotData.empleados || [];
    const semanaInicio = snapshotData.semana_inicio;
    const dates = [];
    let curr = new Date(semanaInicio + "T12:00:00");
    for (let i = 0; i < 7; i++) {
        dates.push(toISODateUTC(curr));
        curr.setUTCDate(curr.getUTCDate() + 1);
    }
    const section = document.createElement("div");
    section.className = "hotel-group";
    section.innerHTML = `
        <div class="hotel-header">
            <h2 class="hotel-name">${escapeHtml(hotel)}</h2>
        </div>
        <div class="grid-table">
            <div class="grid-head">
                <div class="grid-th th-name">Empleado</div>
                ${dates.map(f => {
                    const dObj = new Date(f + 'T12:00:00');
                    return `<div class="grid-th"><span>${weekdayLong[dObj.getUTCDay()].slice(0,1)}</span></div>`;
                }).join('')}
            </div>
            <div class="grid-body">
                ${empleados.sort((a,b) => (Number(a.puestoOrden) || Number(a.orden) || 9999) - (Number(b.puestoOrden) || Number(b.orden) || 9999)).map(emp => {
                    const empName = emp.nombre;
                    const daysMap = emp.dias || emp.cells || {};
                    return `
                        <div class="grid-row" style="${emp.rowType === 'ausencia_informativa' ? 'opacity:0.6;' : ''}">
                            <div class="name-cell">
                                <span class="emp-name">${escapeHtml(empName)}</span>
                            </div>
                            ${dates.map(f => {
                                const day = daysMap[f] || {};
                                const display = window.TurnosRules.getPublicCellDisplay(day, { compact: true });
                                const visual = window.TurnosRules.describeCell(day);
                                return `
                                    <div class="grid-cell" title="${escapeHtml(day.titular_cubierto ? 'Cubriendo a ' + day.titular_cubierto : '')}">
                                        <div class="badge-container">
                                            <span class="badge-shift ${visual.mobileClass}">${formatShiftText(display.text)}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>`;
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
