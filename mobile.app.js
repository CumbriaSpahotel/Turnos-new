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

  function formatWeekRangeLabel(startIso, mode = "full") {
    if (!startIso) return "";
    const start = new Date(startIso + "T12:00:00");
    const end = new Date(startIso + "T12:00:00");
    end.setDate(end.getDate() + 6);
    if (mode === "tight") {
      return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]}`;
    }
    if (mode === "compact") {
      const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
      return sameMonth
        ? `${start.getUTCDate()}-${end.getUTCDate()} ${monthNames[end.getUTCMonth()]} ${end.getUTCFullYear()}`
        : `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
    }
    const startLabel = `${start.getUTCDate()} de ${monthNames[start.getUTCMonth()]}`;
    const endLabel = `${end.getUTCDate()} de ${monthNames[end.getUTCMonth()]} de ${end.getUTCFullYear()}`;
    return `${startLabel} al ${endLabel}`;
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
  const dateRangeLabel = $("#dateRangeLabel");
  const headerHotel = $("#headerHotel");
  let orientationRefreshTimer = null;
  let lastViewportSignature = "";

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
    "cumbria":  { dataName: "Cumbria Spa&Hotel", label: "Cumbria Spa&Hotel" },
    "guadiana": { dataName: "Sercotel Guadiana",  label: "Sercotel Guadiana" }
  };

  function getViewportMetrics() {
    const vv = window.visualViewport;
    const width = vv ? Math.round(vv.width) : window.innerWidth;
    const height = vv ? Math.round(vv.height) : window.innerHeight;
    return { width, height };
  }

  function applyOrientationMode() {
    if (!document.body) return { isLandscape: false, width: window.innerWidth, height: window.innerHeight };
    const { width, height } = getViewportMetrics();
    const isLandscape = width > height;
    document.body.classList.toggle("is-landscape", isLandscape);
    document.body.classList.toggle("is-portrait", !isLandscape);
    document.body.classList.toggle("is-narrow", width <= 430);
    document.body.classList.toggle("is-tight", width <= 380);
    return { isLandscape, width, height };
  }

  function scheduleOrientationRefresh() {
    applyOrientationMode();
    if (orientationRefreshTimer) {
      clearTimeout(orientationRefreshTimer);
    }
    orientationRefreshTimer = setTimeout(() => {
      if (typeof window.refreshMobileView === "function") {
        window.refreshMobileView();
      }
    }, 120);
  }

  function getViewportSignature() {
    const { width, height } = getViewportMetrics();
    const orientation = width > height ? "landscape" : "portrait";
    return `${width}x${height}:${orientation}`;
  }

  function watchViewportRotation() {
    const nextSignature = getViewportSignature();
    if (nextSignature === lastViewportSignature) return;
    lastViewportSignature = nextSignature;
    scheduleOrientationRefresh();
  }

  function renderEmptyState(message, detail = "") {
    shiftGrid.innerHTML = `
      <div class="empty-state" style="padding:40px 24px; text-align:center; color:var(--muted);">
        <div class="empty-icon" style="font-size:2.5rem; margin-bottom:10px;">📅</div>
        <div class="empty-title" style="font-weight:700; font-size:1rem; line-height:1.35; margin-bottom:${detail ? "8px" : "0"};">${escapeHtml(message)}</div>
        ${detail ? `<div class="empty-detail" style="font-weight:600; font-size:0.88rem; line-height:1.45; opacity:0.9;">${escapeHtml(detail)}</div>` : ""}
      </div>
    `;
  }

  function renderInitialState() {
    shiftGrid.innerHTML = `
      <div class="welcome-state">
        <div class="welcome-card">
          <div class="welcome-icon">🏨</div>
          <div class="welcome-eyebrow">Vista publicada</div>
          <div class="welcome-title">Consulta turnos, descansos y cambios de la semana en un solo vistazo</div>
          <div class="welcome-detail">Esta vista móvil te permite revisar el cuadrante publicado con una lectura rápida, clara y adaptada al teléfono.</div>
          <div class="welcome-features">
            <div class="welcome-feature">
              <span class="welcome-feature-icon">📅</span>
              <span class="welcome-feature-text">Semana actual siempre visible</span>
            </div>
            <div class="welcome-feature">
              <span class="welcome-feature-icon">🏷️</span>
              <span class="welcome-feature-text">Turnos y descansos identificados por color</span>
            </div>
            <div class="welcome-feature">
              <span class="welcome-feature-icon">📲</span>
              <span class="welcome-feature-text">Diseño optimizado para móvil vertical y horizontal</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.refreshMobileView = async function() {
    if (!dateInput.value) {
        dateInput.value = toISODateUTC(mondayOf(new Date()));
    }
    const startIso = dateInput.value;
    const dEnd = new Date(startIso + "T12:00:00");
    dEnd.setDate(dEnd.getDate() + 6);
    const endIso = toISODateUTC(dEnd);
    const viewportState = applyOrientationMode();
    const labelMode = viewportState.width <= 380
      ? "tight"
      : (viewportState.isLandscape || viewportState.width <= 430 ? "compact" : "full");
    const weekRangeLabel = formatWeekRangeLabel(startIso, labelMode);
    if (dateInput) {
        dateInput.setAttribute("aria-label", weekRangeLabel);
        dateInput.title = weekRangeLabel;
    }
    if (dateRangeLabel) {
        dateRangeLabel.textContent = weekRangeLabel;
    }

    // Actualizar etiqueta del selector con el nombre amigable
    const selectedId = hotelSelect.value;
    const hotelInfo = HOTEL_MAP[selectedId];
    const headerEl = document.querySelector("header");
    if (headerEl) {
        headerEl.classList.toggle("hotel-selected", !!hotelInfo);
    }
    if (document.body) {
        document.body.classList.toggle("hotel-selected-mode", !!hotelInfo);
    }
    if (headerHotel) {
        headerHotel.textContent = hotelInfo ? hotelInfo.label : "";
    }
    if (hotelSelect.options[0]) {
        hotelSelect.options[0].text = hotelInfo ? `🏨 ${hotelInfo.label}` : "🏨 SELECCIONAR HOTEL";
    }

    if (!hotelInfo) {
        renderInitialState();
        return;
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
            const availableHotels = [...new Set(
                snapshots
                  .map(s => String(s.hotel || "").trim())
                  .filter(Boolean)
            )];
            const msg = hotelInfo
                ? `Has elegido ${hotelInfo.label}, pero no hay cuadrante publicado para esa semana.`
                : "No hay cuadrantes publicados para esta semana.";
            const detail = hotelInfo && availableHotels.length
                ? `<div style="margin-top:8px; font-size:0.9rem; font-weight:700;">Publicación disponible en: ${escapeHtml(availableHotels.join(", "))}.</div>`
                : "";
            shiftGrid.innerHTML = `<div style="padding:40px 24px; text-align:center; opacity:0.78; color:var(--muted); font-weight:600;"><div style="font-size:2.5rem; margin-bottom:10px;">📅</div><div style="font-size:1rem; line-height:1.4;">${escapeHtml(msg)}</div>${detail}</div>`;
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

  function getMobileShiftLabel(displayText, visualClass) {
    const raw = String(displayText || "").trim();
    const normalized = raw.toUpperCase();
    if (visualClass === "v" || normalized.includes("VAC")) return "🏖️";

    const base = raw.split(/\s+/)[0] || "";
    const hasChange = raw.includes("🔄");
    const isNight = visualClass === "n" || base === "N";

    if (visualClass === "m" || visualClass === "t" || visualClass === "n" || visualClass === "d" || visualClass === "b" || visualClass === "p") {
      const mainLabel = isNight
        ? `${escapeHtml(base)}<span class="emoji-indicator night-indicator" aria-hidden="true">🌙</span>`
        : escapeHtml(base);
      return `${mainLabel}${hasChange ? '<span class="change-indicator-bottom" aria-label="Cambio de turno">↺</span>' : ''}`;
    }

    return formatShiftText(raw);
  }

  function getMobileShiftToken(displayText, visualClass) {
    const normalized = String(displayText || "")
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .trim()
      .toUpperCase();

    if (visualClass && visualClass !== "empty") return visualClass;
    if (normalized === "D" || normalized.includes("DESC")) return "d";
    if (normalized === "M" || normalized.includes("MAN")) return "m";
    if (normalized === "T" || normalized.includes("TAR")) return "t";
    if (normalized === "N" || normalized.includes("NOC")) return "n";
    if (normalized.includes("VAC")) return "v";
    if (normalized.includes("BAJA") || normalized === "IT" || normalized === "BM") return "b";
    if (normalized.includes("PERM")) return "p";
    return visualClass || "empty";
  }

  async function renderSnapshotTable(hotel, snapshotData, container) {
    const empleados = snapshotData.empleados || [];
    const semanaInicio = snapshotData.semana_inicio;
    const isNarrowMobile = window.innerWidth <= 430;
    const longestNameLength = empleados.reduce((max, emp) => {
      const nameLength = String(emp?.nombre || "").trim().length;
      return Math.max(max, nameLength);
    }, "Empleado".length);
    const nameColWidth = Math.max(88, Math.min(122, Math.round(longestNameLength * 6.2 + 20)));
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
        <div class="grid-table" style="--name-col-w:${nameColWidth}px;">
            <div class="grid-head">
                <div class="grid-th th-name">Empleado</div>
                ${dates.map(f => {
                    const dObj = new Date(f + 'T12:00:00');
                    const dateLabel = isNarrowMobile
                      ? `${dObj.getUTCDate()}`
                      : `${dObj.getUTCDate()}/${monthNames[dObj.getUTCMonth()]}`;
                    return `<div class="grid-th day-th"><span class="day-letter">${weekdayLong[dObj.getUTCDay()].slice(0,1)}</span><span class="day-date">${dateLabel}</span></div>`;
                }).join('')}
            </div>
            <div class="grid-body">
                ${(() => {
                    // De-duplicación y Orden Estricto (Operativos -> Ausentes)
                    const uniqueEmpsMap = new Map();
                    const norm = (str) => {
                        if (window.normalizeId) return window.normalizeId(str);
                        if (window.TurnosDB && window.TurnosDB.normalizeString) return window.TurnosDB.normalizeString(str);
                        return String(str || '').toLowerCase().trim();
                    };

                    empleados.forEach(e => {
                        const id = norm(e.empleado_id || e.nombre);
                        const isAbsent = e.rowType === 'ausencia_informativa';
                        if (!uniqueEmpsMap.has(id)) {
                            uniqueEmpsMap.set(id, e);
                        } else {
                            const existing = uniqueEmpsMap.get(id);
                            if (existing.rowType === 'ausencia_informativa' && !isAbsent) {
                                uniqueEmpsMap.set(id, e);
                            }
                        }
                    });

                    return Array.from(uniqueEmpsMap.values()).sort((a,b) => {
                        const isAbsentA = a.rowType === 'ausencia_informativa';
                        const isAbsentB = b.rowType === 'ausencia_informativa';
                        if (isAbsentA !== isAbsentB) return isAbsentA ? 1 : -1;
                        const valA = Number(a.puestoOrden) || Number(a.orden) || 9999;
                        const valB = Number(b.puestoOrden) || Number(b.orden) || 9999;
                        return valA - valB;
                    });
                })().map(emp => {
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
                                const shiftToken = getMobileShiftToken(display.text, visual.mobileClass);
                                return `
                                    <div class="grid-cell" title="${escapeHtml(day.titular_cubierto ? 'Cubriendo a ' + day.titular_cubierto : '')}">
                                        <div class="badge-container">
                                            <span class="badge-shift ${shiftToken}" data-shift="${escapeHtml(shiftToken)}">${getMobileShiftLabel(display.text, shiftToken)}</span>
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

  window.goHomeMobileView = function() {
    if (hotelSelect) {
      hotelSelect.value = "";
    }
    window.refreshMobileView();
  };

  if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === "function") {
    window.screen.orientation.addEventListener("change", scheduleOrientationRefresh);
  }
  if (window.matchMedia) {
    const landscapeMq = window.matchMedia("(orientation: landscape)");
    if (typeof landscapeMq.addEventListener === "function") {
      landscapeMq.addEventListener("change", scheduleOrientationRefresh);
    } else if (typeof landscapeMq.addListener === "function") {
      landscapeMq.addListener(scheduleOrientationRefresh);
    }
  }
  window.addEventListener("orientationchange", scheduleOrientationRefresh);
  window.addEventListener("resize", scheduleOrientationRefresh);
  window.addEventListener("pageshow", scheduleOrientationRefresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleOrientationRefresh();
  });
  if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
    window.visualViewport.addEventListener("resize", scheduleOrientationRefresh);
  }
  window.setInterval(watchViewportRotation, 500);

  window.initMobileSunc = async function() {
    applyOrientationMode();
    lastViewportSignature = getViewportSignature();
    await window.refreshMobileView();
  };
})();
