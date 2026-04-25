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
  function getPublicCellDisplay(cell, options = {}) {
    const compact = !!options.compact;
    const rawLabel = String(cell?.label || cell?.displayLabel || '').trim();
    const code = String(cell?.code || cell?.tipo || '').toUpperCase().trim();

    let label = rawLabel;

    // Normalización a nombres completos primero
    if (!label || ['M','T','N','D','VAC','BAJA','PERM','PERMISO','FORM'].includes(label.toUpperCase())) {
        const key = label.toUpperCase() || code;
        label = {
            M: 'Mañana',
            T: 'Tarde',
            N: 'Noche',
            D: 'Descanso',
            VAC: 'Vacaciones',
            BAJA: 'Baja',
            PERM: 'Permiso',
            PERMISO: 'Permiso',
            FORM: 'Formación'
        }[key] || label || '—';
    }

    const icons = new Set();
    const origen = String(cell?.origen || cell?.source || cell?.tipo_evento || '').toLowerCase();
    const explicitIcons = Array.isArray(cell?.icons) ? cell.icons : [];

    explicitIcons.forEach(i => {
        if (['🌙','🏖️','🗓️','🤒','🎓','🔄'].includes(i)) icons.add(i);
    });

    if (/noche/i.test(label) || code === 'N') icons.add('🌙');
    if (/vacaciones/i.test(label) || code === 'VAC') icons.add('🏖️');
    if (/permiso/i.test(label) || code === 'PERM' || code === 'PERMISO') icons.add('🗓️');
    if (/baja/i.test(label) || code === 'BAJA') icons.add('🤒');
    if (/formaci/i.test(label) || code === 'FORM') icons.add('🎓');

    const isRealChange =
        (origen.includes('ct') ||
         origen.includes('cambio') ||
         origen.includes('intercambio') ||
         String(cell?.tipo_evento || '').toUpperCase().includes('INTERCAMBIO') ||
         String(cell?.tipo_evento || '').toUpperCase() === 'CT') &&
        !origen.includes('sustitucion') &&
        !origen.includes('vacaciones') &&
        !origen.includes('ausencia');

    if (isRealChange) icons.add('🔄');

    const absenceCodes = ['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORM'];
    const isAbsence = absenceCodes.includes(code)
        || /vacaciones|baja|permiso|formaci/i.test(label);

    if (isAbsence) {
        icons.delete('🔄');
    }

    // Eliminar iconos decorativos no deseados en Mañana/Tarde/Descanso
    if (label === 'Mañana') { icons.delete('☀️'); icons.delete('🌞'); icons.delete('🌅'); }
    if (label === 'Tarde')  { icons.delete('☀️'); icons.delete('🌞'); icons.delete('🌅'); }
    if (label === 'Descanso' && !isRealChange) { icons.delete('🔄'); }

    // Si es compacto (móvil), convertir label completo a código corto
    if (compact) {
        const compactMap = {
            'Mañana': 'M',
            'Tarde': 'T',
            'Noche': 'N',
            'Descanso': 'D',
            'Vacaciones': 'VAC',
            'Baja': 'BAJA',
            'Permiso': 'PERM',
            'Formación': 'FORM'
        };
        label = compactMap[label] || label;
    }

    return {
        label,
        icons: Array.from(icons),
        text: label === '—' ? '—' : `${label}${icons.size ? ' ' + Array.from(icons).join(' ') : ''}`
    };
  }

  function getDisplayInfo(item) {
    if (!item) return { label: '·', cls: 'empty', icon: '', title: '' };
    const display = getPublicCellDisplay(item, { compact: true });
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

  window.refreshMobileView = async function() {
    if (!dateInput.value) {
        dateInput.value = toISODateUTC(mondayOf(new Date()));
    }
    const startIso = dateInput.value;
    const dEnd = new Date(startIso + "T12:00:00");
    dEnd.setDate(dEnd.getDate() + 6);
    const endIso = toISODateUTC(dEnd);
    shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.5; font-weight:700;">Cargando publicación...</div>`;
    try {
        const result = await window.TurnosDB.loadPublishedSchedule({
            semanaInicio: startIso,
            semanaFin: endIso,
            hotel: hotelSelect.value || null
        });
        if (!result.ok) {
            shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.6; color:var(--muted); font-weight:600;"><div style="font-size:2.5rem; margin-bottom:10px;">📅</div>${result.message}</div>`;
            return;
        }
        const hotelVal = hotelSelect.value || "";
        shiftGrid.innerHTML = "";
        for (const snap of result.snapshots) {
            if (hotelVal && snap.hotel !== hotelVal) continue;
            await renderSnapshotTable(snap.hotel, snap.data, shiftGrid);
        }
        if (shiftGrid.innerHTML === "") {
            shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.5; color:var(--muted);">No hay cuadrantes publicados para los filtros seleccionados.</div>`;
        }
    } catch(e) { 
        console.error("Error en vista móvil:", e);
        shiftGrid.innerHTML = `<div style="padding:40px; text-align:center; color:#ef4444;">Error de conexión. Reintente.</div>`;
    }
  };

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
                    return `<div class="grid-th"><span>${weekdayLong[dayObj.getUTCDay()]}</span><br><span style="opacity:0.6; font-size:0.75rem; font-weight:500;">${dayLabel}</span></div>`;
                }).join('')}
            </div>
            <div class="grid-body">
                ${empleados.sort((a,b) => a.orden - b.orden).map(emp => {
                    const empName = emp.nombre;
                    const daysMap = emp.dias || {};
                    let n = 0, dCount = 0;
                    dates.forEach(f => {
                        const d = daysMap[f] || {};
                        const c = (d.code || '').toLowerCase();
                        if (c.startsWith('n')) n++;
                        if (c.startsWith('d')) dCount++;
                    });
                    return `
                        <div class="grid-row">
                            <div class="name-sticky">
                                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text); font-family:'Outfit', sans-serif; font-weight:600; font-size:0.8rem; letter-spacing:0.01em;">${escapeHtml(empName)}</span>
                            </div>
                            ${dates.map(f => {
                                const day = daysMap[f] || {};
                                const display = getPublicCellDisplay(day, { compact: true });
                                const visual = window.TurnosRules.describeCell(day);
                                return `<div class="grid-cell" title="${escapeHtml(day.titular_cubierto ? 'Cubriendo a ' + day.titular_cubierto : '')}">
                                    <span class="badge-shift ${visual.mobileClass}">${escapeHtml(display.text)}</span>
                                </div>`;
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
