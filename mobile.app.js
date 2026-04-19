/* mobile.app.js
   Versión móvil (modo C):
   - Usa window.FULL_DATA generado por data.js (igual que index)
   - Hotel: Todos → muestra un bloque por hotel, uno debajo de otro
   - Hotel concreto → una sola tabla
*/

(function () {
  const $  = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  const pad = n => String(n).padStart(2, "0");
  const weekdayShort = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  function mondayOf(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day); // lunes
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }

  function toISODateUTC(date) {
    return [
      date.getUTCFullYear(),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate())
    ].join("-");
  }

  function addDays(date, n) {
    const d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  }

  function getLabel(turno) {
    if (!turno) return "";
    let val = turno;
    if (typeof val === "object" && val !== null) {
      // Prioridad: TurnoOriginal es el nombre real (Mañana, Tarde, etc.)
      val = val.TurnoOriginal || val.TurnoReal || val.turno || val.TipoInterpretado || "";
    }
    let txt = String(val || "").trim();
    
    // Limpieza agresiva: si el texto ES o CONTIENE la etiqueta técnica, la quitamos
    if (txt.toLowerCase().includes("cambio de turno") || txt.toLowerCase().includes("c/t")) {
      txt = txt.replace(/Cambio de Turno/gi, "").replace(/C\/T/gi, "").trim();
      if (!txt) txt = "🔄"; // Si se queda vacío, al menos el icono
    }
    
    // Si sigue siendo muy largo, es que algo ha fallado en la limpieza, forzamos icono
    if (txt.length > 20 && txt.includes("Cambio")) return "🔄";

    return window.MobilePatch ? window.MobilePatch.normalize(txt) : txt;
  }

  function getFlag(item) {
    try {
      const raw = item && item.turno;
      const text = getLabel(raw).toLowerCase();

      if (text.includes("sustit")) return { type: "sub", symbol: "↔", title: "Sustitución" };
      if (text.includes("cambio") || text.includes("🔄"))
        return { type: "swap", symbol: "🔄", title: "Cambio de turno" };

      if (raw && typeof raw === "object") {
        const keys = Object.keys(raw).map(k => k.toLowerCase());
        if (keys.some(k => k.includes("sustit")))
          return { type: "sub", symbol: "↔", title: "Sustitución" };
        if (keys.some(k => k.includes("cambio") || k.includes("swap")))
          return { type: "swap", symbol: "🔄", title: "Cambio de turno" };
        if (raw.esSustituto || raw.sustituto)
          return { type: "sub", symbol: "↔", title: "Sustitución" };
        if (raw.cambio === true)
          return { type: "swap", symbol: "🔄", title: "Cambio de turno" };
      }
    } catch (e) {}
    return null;
  }

  function logoFor(hotel) {
    const h = (hotel || "").toLowerCase();
    if (h.includes("guadiana")) return "img/guadiana.jpg";
    if (h.includes("cumbria")) return "img/cumbria.jpg";
    return "img/turnos_icon.png";
  }

  const weekPicker  = $("#weekPicker");
  const hotelSelect = $("#hotelSelect");
  const prevWeekBtn = $("#prevWeekBtn");
  const todayBtn    = $("#todayBtn");
  const nextWeekBtn = $("#nextWeekBtn");

  const singleCard  = $("#singleCard");
  const multi       = $("#multi");
  const theadEl     = $("#thead");
  const tbodyEl     = $("#tbody");
  const hotelTitle  = $("#hotelTitle");
  const hotelLogo   = $("#hotelLogo");

  function getData() {
    // Ya no usamos Firebase. Usamos los datos cargados por el DAO (Supabase)
    const data = window.FULL_DATA || { schedule: [], flat: [] };
    
    // Si no hay datos en memoria, intentamos recuperar del caché local (persistente)
    if ((!data.schedule || data.schedule.length === 0) && (!data.flat || data.flat.length === 0)) {
        try {
            const local = localStorage.getItem('turnosweb_admin_data_flat');
            if (local) {
                return { schedule: [], flat: JSON.parse(local) };
            }
        } catch(e) {}
    }
    return data;
  }


  function getHotels(data) {
    return Array.from(new Set((data.schedule || []).map(s => s.hotel))).filter(Boolean).sort();
  }


  // ---- Render cabecera días ----
  function renderHeader(thead, monday) {
    thead.innerHTML = [
      `<div class="th"></div>`,
      ...[0, 1, 2, 3, 4, 5, 6].map(i => {
        const d = addDays(monday, i);
        return `<div class="th">
          <div class="weekday">
            <span class="name">${weekdayShort[i]}</span>
            <span class="date">${d.toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "short",
              year: "2-digit"
            })}</span>
          </div>
        </div>`;
      })
    ].join("");
  }

  // ---- Render filas ----
  function renderBody(tbody, weekData) {
    tbody.innerHTML = "";
    const monday    = weekData.monday;
    const empleados = weekData.empleados || [];

    empleados.forEach(emp => {
      const row = document.createElement("div");
      row.className = "row";

      const name = document.createElement("div");
      name.className = "cell-name";
      name.textContent = window.MobilePatch
        ? window.MobilePatch.normalize(emp)
        : emp;
      row.appendChild(name);

      for (let i = 0; i < 7; i++) {
        const d = addDays(monday, i);
        const dkey = toISODateUTC(d);
        const item =
          (weekData.turnosByEmpleado &&
           weekData.turnosByEmpleado[emp] &&
           weekData.turnosByEmpleado[emp][dkey]) ||
          null;

        const cell = document.createElement("div");
        cell.className = "cell";

        if (item) {
          const pill = document.createElement("span");
          pill.className = "pill";

          let label = getLabel(item.turno);
          const tipo = item.tipo || '';
          const low = label.toLowerCase();

          if (tipo === 'VAC' || low.includes("vacac")) {
            pill.classList.add("pill--vacaciones");
            label = "Vacaciones 🏖️";
          } else if (tipo === 'BAJA' || low.includes("baja")) {
            pill.classList.add("pill--descanso"); 
            label = "Baja Médica 🏥";
          } else if (tipo === 'PERM' || low.includes("perm")) {
            pill.classList.add("pill--tarde");
            label = "Permiso 📄";
          } else if (tipo === 'CT' || low.includes("sustit") || low.includes("cambio")) {
            pill.classList.add("pill--noche");
            label = `${item.sustituto || 'C/T'} 🔄`;
          } else if (low.includes("descanso")) {
            pill.classList.add("pill--descanso");
            label = "Descanso";
          } else if (low.includes("noche")) {
            pill.classList.add("pill--noche");
            label = "🌙 Noche";
          } else if (low.includes("mañana")) {
            pill.classList.add("pill--manana");
            label = "Mañana";
          } else if (low.includes("tarde")) {
            pill.classList.add("pill--tarde");
            label = "Tarde";
          } else {
            pill.classList.add("pill--noche");
          }

          pill.textContent = label;

          const flag = getFlag(item);
          if (flag) {
            const b = document.createElement("span");
            b.className = "badge";
            b.title = flag.title;
            b.textContent = flag.symbol;
            pill.appendChild(b);
          }

          cell.appendChild(pill);
        }

        row.appendChild(cell);
      }

      tbody.appendChild(row);
    });
  }

  // ---- Vista 1 hotel ----
  function renderSingleHotel(hotel, monday, data) {
    const weekData   = window.MobileAdapter.buildWeekData(data, hotel, monday);

    const baseMonday = weekData.monday || monday;
    renderHeader(theadEl, baseMonday);
    renderBody(tbodyEl, weekData);

    const logoSrc = logoFor(hotel);
    hotelLogo.src = logoSrc;
    hotelTitle.textContent = hotel || "Todos los hoteles";
  }

  // ---- Vista todos los hoteles ----
  function renderAllHotels(monday, data) {
    multi.innerHTML = "";
    const hotels = getHotels(data);

    hotels.forEach(hotel => {
      const weekData   = window.MobileAdapter.buildWeekData(data, hotel, monday);
      const baseMonday = weekData.monday || monday;

      const section = document.createElement("section");
      section.className = "hotel-section";

      const card = document.createElement("div");
      card.className = "card";

      const thead = document.createElement("div");
      thead.className = "thead";

      const tbody = document.createElement("div");
      tbody.className = "tbody";

      card.appendChild(thead);
      card.appendChild(tbody);
      section.appendChild(card);
      multi.appendChild(section);

      const logoSrc = logoFor(hotel);
      const hotelLabel = window.MobilePatch
        ? window.MobilePatch.normalize(hotel)
        : hotel;

      thead.innerHTML = [
        `<div class="th th-hotel">
          <div class="hotel-cell">
            <img class="hotel-cell-logo" src="${logoSrc}" alt="${hotelLabel}">
            <span class="hotel-cell-name">${hotelLabel}</span>
          </div>
        </div>`,
        ...[0, 1, 2, 3, 4, 5, 6].map(i => {
          const d = addDays(baseMonday, i);
          return `<div class="th">
            <div class="weekday">
              <span class="name">${weekdayShort[i]}</span>
              <span class="date">${d.toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "short",
                year: "2-digit"
              })}</span>
            </div>
          </div>`;
        })
      ].join("");

      renderBody(tbody, weekData);
    });
  }

  // ---- Refresh global ----
  window.refreshMobileView = function() {
    const data = getData();
    const hotels = getHotels(data);
    
    // Actualizar selector de hoteles si es necesario
    const currentHotel = hotelSelect.value;
    hotelSelect.innerHTML = `<option value="__ALL__">Todos</option>` +
      hotels.map(h => `<option value="${h}" ${h === currentHotel ? 'selected' : ''}>${h}</option>`).join("");

    if (!weekPicker.value) {
      const mondayToday = mondayOf(new Date());
      weekPicker.value  = toISODateUTC(mondayToday);
    }

    const hotelVal = hotelSelect.value || "__ALL__";
    const monday   = new Date(weekPicker.value + "T00:00:00");

    if (hotelVal === "__ALL__") {
      singleCard.style.display = "none";
      multi.style.display      = "block";
      renderAllHotels(monday, data);
      hotelLogo.src   = "img/turnos_icon.png";
      hotelTitle.textContent = "Todos los hoteles";
    } else {
      multi.style.display      = "none";
      singleCard.style.display = "block";
      renderSingleHotel(hotelVal, monday, data);
    }
  };

  function refresh() { window.refreshMobileView(); }


  // ---- Eventos ----
  hotelSelect.addEventListener("change", refresh);
  weekPicker.addEventListener("change", refresh);

  function setWeekByOffset(offsetDays) {
    const d = weekPicker.value
      ? new Date(weekPicker.value + "T00:00:00")
      : mondayOf(new Date());
    d.setUTCDate(d.getUTCDate() + offsetDays);
    weekPicker.value = toISODateUTC(mondayOf(d));
    refresh();
  }

  prevWeekBtn.addEventListener("click", () => setWeekByOffset(-7));
  nextWeekBtn.addEventListener("click", () => setWeekByOffset(7));
  todayBtn.addEventListener("click", () => {
    const mondayToday = mondayOf(new Date());
    weekPicker.value  = toISODateUTC(mondayToday);
    refresh();
  });

  // ---- Init ----
  (function init() {
    const data = getData();
    const hotels = getHotels(data);

    hotelSelect.innerHTML = [
      `<option value="__ALL__">Todos</option>`,
      ...hotels.map(h => `<option value="${h}">${h}</option>`)
    ].join("");

    const mondayToday = mondayOf(new Date());
    weekPicker.value  = toISODateUTC(mondayToday);

    window.refreshMobileView();
  })();

})();
