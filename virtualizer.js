class VirtualTable {
    constructor(container, options) {
        this.container = container;
        this.columns = options.columns;
        this.data = [];
        this.rowHeight = options.rowHeight || 44;
        this.compact = options.compact || false;
        this.buffer = 5;
        this.rowPool = [];
        this.initDOM();
    }

    initDOM() {
        this.container.innerHTML = '';
        this.viewport = document.createElement('div');
        this.viewport.className = 'viewport';
        this.viewport.style.overflowY = 'auto';
        this.viewport.style.height = '70vh'; 
        this.viewport.style.minHeight = '500px';
        this.viewport.style.position = 'relative';
        this.viewport.style.background = 'var(--bg2)';
        this.viewport.style.border = '1px solid var(--border)';
        this.viewport.style.borderRadius = '20px';
        this.viewport.style.boxShadow = 'var(--shadow-sm)';
        
        this.spacerTop = document.createElement('div');
        this.spacerBottom = document.createElement('div');
        this.tableWrap = document.createElement('div');
        
        const table = document.createElement('table');
        table.className = 'preview-table-v2';
        table.style.width = '100%';
        table.style.borderCollapse = 'separate';
        table.style.borderSpacing = '0 4px';
        
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        trHead.innerHTML = `<th style="position:sticky; left:0; z-index:20; background:var(--bg3); border-bottom:1px solid var(--border); padding:10px;">Personal</th>` + this.columns.map(c => `
            <th class="${c.isWeekend ? 'weekend' : ''} ${c.isToday ? 'today' : ''}" style="padding:8px; text-align:center; min-width:${this.compact ? '30px' : '60px'}; position:sticky; top:0; z-index:15; background:var(--bg3); border-bottom:1px solid var(--border);">
                <div style="font-size:0.6rem; color:var(--text-dim); text-transform:uppercase;">${c.title}</div>
                <div style="font-size:0.85rem; font-weight:800; color:var(--text);">${c.subtitle}</div>
            </th>
        `).join('');
        thead.appendChild(trHead);
        table.appendChild(thead);
        
        this.tbody = document.createElement('tbody');
        table.appendChild(this.tbody);
        this.tableWrap.appendChild(table);
        this.spacerTop.appendChild(document.createTextNode(' '));
        this.spacerBottom.appendChild(document.createTextNode(' '));
        
        this.viewport.appendChild(this.spacerTop);
        this.viewport.appendChild(this.tableWrap);
        this.viewport.appendChild(this.spacerBottom);
        this.container.appendChild(this.viewport);
        
        // Pool of rows
        const visibleMax = Math.ceil(1200 / this.rowHeight) + (this.buffer * 2);
        for(let i=0; i < visibleMax; i++) {
            const tr = document.createElement('tr');
            tr.style.height = `${this.rowHeight}px`;
            tr.style.display = 'none';
            
            // Employee Cell
            const tdEmp = document.createElement('td');
            tdEmp.className = 'emp-cell';
            tdEmp.style.position = 'sticky'; tdEmp.style.left = '0';
            tdEmp.style.background = 'var(--surface)'; tdEmp.style.fontWeight = '700';
            tdEmp.style.borderRight = '1px solid var(--border)'; tdEmp.style.zIndex = '10';
            tdEmp.style.padding = '0 15px';
            tr.appendChild(tdEmp);
            
            // Shift Cells
            this.columns.forEach(() => {
                const td = document.createElement('td');
                td.className = 'turno-cell';
                td.style.textAlign = 'center'; td.style.padding = '3px';
                tr.appendChild(td);
            });
            this.rowPool.push(tr);
            this.tbody.appendChild(tr);
        }

        this.tbody.addEventListener('click', (e) => {
            const cell = e.target.closest('td');
            if (!cell || !cell.dataset.empleadoId) return;
            if (cell.classList.contains('header-row-cell')) return;

            const event = new CustomEvent('cellEdit', {
                detail: { empleado: cell.dataset.empleadoId, fecha: cell.dataset.fecha, cellElement: cell }
            });
            this.container.dispatchEvent(event);
        });

        this.viewport.addEventListener('scroll', () => { this.onScroll(); }, { passive: true });
    }

    setData(newData) { 
        this.data = newData; 
        this.onScroll(); 
    }

    onScroll() {
        if (!this.data.length) return;
        const scrollTop = this.viewport.scrollTop;
        const viewportHeight = this.viewport.clientHeight || 800;
        const visibleRowsCount = Math.ceil(viewportHeight / this.rowHeight);
        
        let start = Math.floor(scrollTop / this.rowHeight) - this.buffer;
        if (start < 0) start = 0;
        let end = start + visibleRowsCount + (this.buffer * 2);
        if (end > this.data.length) end = this.data.length;

        this.spacerTop.style.height = `${start * this.rowHeight}px`;
        this.spacerBottom.style.height = `${Math.max(0, (this.data.length - end) * this.rowHeight)}px`;

        for (let i = 0; i < this.rowPool.length; i++) {
            const tr = this.rowPool[i];
            const dataIdx = start + i;
            
            if (dataIdx >= end || dataIdx >= this.data.length) {
                tr.style.display = 'none';
            } else {
                tr.style.display = '';
                this.renderRow(tr, this.data[dataIdx]);
            }
        }
    }

    renderRow(tr, rowData) {
        const tds = tr.children;
        
        // Check if it's a header row
        if (rowData.isHeader) {
            tr.classList.add('header-row');
            const td = tds[0];
            td.colSpan = this.columns.length + 1;
            td.innerHTML = `<div style="display:flex; align-items:center; gap:10px; padding:10px; background:var(--bg3); border-radius:12px; margin:5px 10px;">
                <span style="font-size:1.2rem;">🏨</span>
                <span style="text-transform:uppercase; letter-spacing:0.1em; font-weight:900; color:var(--accent);">${rowData.title}</span>
            </div>`;
            // Hide other tds
            for(let i=1; i<tds.length; i++) tds[i].style.display = 'none';
            return;
        }

        // Normal row
        tr.classList.remove('header-row');
        tds[0].colSpan = 1;
        tds[0].style.display = '';
        
        // Logo + Nombre + Badges (V8.2 Premium)
        const hotel = rowData.hotel_id || 'GENERAL';
        const logoUrl = hotel.includes('Guadiana') ? 'guadiana logo.jpg' : 'cumbria logo.jpg';
        
        // Calcular estadísticas de la fila (noches y descansos)
        let nights = 0, rests = 0;
        rowData.cells.forEach(c => {
            const t = String(c.turno || '').toLowerCase();
            const tp = String(c.tipo || '').toLowerCase();
            if (t.includes('noche') || t === 'n') nights++;
            if (t.includes('descanso') || t === 'd') rests++;
        });

        tds[0].innerHTML = `
            <img src="${logoUrl}" class="emp-logo" onerror="this.style.display='none'">
            <div style="display:flex; flex-direction:column; cursor:pointer;" onclick="window.openEmpDrawer('${rowData.empName}')">
                <span style="font-weight:700; color:var(--accent);">${rowData.empName}</span>
            </div>
            <div class="emp-badges">
                <span class="emp-badge">🌙 ${nights}</span>
                <span class="emp-badge">D ${rests}</span>
            </div>
        `;

        for (let i = 0; i < this.columns.length; i++) {
            const td = tds[i+1];
            td.style.display = '';
            this.renderCellContent(td, rowData.cells[i], rowData.empName, this.columns[i].dbFecha);
        }
    }

    renderCellContent(cell, cellData, empName, fecha) {
        cell.dataset.empleadoId = empName;
        cell.dataset.fecha = cellData.fecha || fecha;

        const type = String(cellData.tipo || 'NORMAL').toUpperCase();
        const rawTurno = String(cellData.turno || '').toLowerCase();
        let cleanShiftColorCls = 'v-empty';
        let cleanLabel = '';
        let cleanIcon = '';

        if (type.startsWith('VAC')) {
            cleanShiftColorCls = 'v-vac';
            cleanLabel = 'Vacaciones';
        } else if (type.startsWith('BAJA')) {
            cleanShiftColorCls = 'v-baja';
            cleanLabel = 'Baja';
        } else if (type.startsWith('PERM')) {
            cleanShiftColorCls = 'v-perm';
            cleanLabel = 'Permiso';
        } else if (type.startsWith('CT')) {
            cleanShiftColorCls = 'v-cambio';
            cleanLabel = 'C/T';
        } else if (rawTurno.includes('mañana') || rawTurno.includes('maã±ana') || rawTurno === 'm') {
            cleanShiftColorCls = 'v-mañana';
            cleanLabel = 'Mañana';
        } else if (rawTurno.includes('tarde') || rawTurno === 't') {
            cleanShiftColorCls = 'v-tarde';
            cleanLabel = 'Tarde';
        } else if (rawTurno.includes('noche') || rawTurno === 'n') {
            cleanShiftColorCls = 'v-noche';
            cleanLabel = 'Noche';
        } else if (rawTurno.includes('descanso') || rawTurno === 'd') {
            cleanShiftColorCls = 'v-descanso';
            cleanLabel = 'Descanso';
        }

        if (cellData.isSub) {
            cleanIcon = '<->';
            cell.title = `Sustituyendo a ${cellData.subFor}`;
        } else {
            cell.title = '';
        }

        const cleanClsString = `v-cell ${cleanShiftColorCls}`;
        if (cell.className !== cleanClsString) cell.className = cleanClsString;
        const cleanDisplayHTML = `<div class="v-pill">${cleanLabel}${cleanIcon ? ` <small>${cleanIcon}</small>` : ''}</div>`;
        if (cell.innerHTML !== cleanDisplayHTML) cell.innerHTML = cleanDisplayHTML;
        return;
        
        const typeMapping = { 
            'VAC 🏖️': { cls: 'v-vac', label: 'Vacaciones 🏖️', icon: '' }, 
            'BAJA 🏥': { cls: 'v-baja', label: 'Baja Médica 🏥', icon: '' }, 
            'PERM 🗓️': { cls: 'v-perm', label: 'Permiso 🗓️', icon: '' }, 
            'CT 🔄': { cls: 'v-cambio', label: 'C/T 🔄', icon: '' }, 
            'NORMAL': { cls: 'v-normal', label: '', icon: '' },
            'VAC': { cls: 'v-vac', label: 'Vacaciones 🏖️', icon: '' }, 
            'BAJA': { cls: 'v-baja', label: 'Baja Médica 🏥', icon: '' }, 
            'PERM': { cls: 'v-perm', label: 'Permiso 🗓️', icon: '' }, 
            'CT': { cls: 'v-cambio', label: 'C/T 🔄', icon: '' }
        };

        const config = typeMapping[cellData.tipo] || typeMapping['NORMAL'];
        let shiftColorCls = config.cls;
        let icon = config.icon;
        let label = (cellData.tipo && cellData.tipo !== 'NORMAL') ? config.label : (cellData.turno || '');

        if (cellData.tipo === 'NORMAL' || !cellData.tipo) {
            const t = String(label).toLowerCase();
            if (t.includes('mañana') || t === 'm') { shiftColorCls = 'v-mañana'; icon = '☀️'; label = 'Mañana'; }
            else if (t.includes('tarde') || t === 't') { shiftColorCls = 'v-tarde'; icon = '⛅'; label = 'Tarde'; }
            else if (t.includes('noche') || t === 'n') { shiftColorCls = 'v-noche'; icon = '🌙'; label = 'Noche'; }
            else if (t.includes('descanso') || t === 'd') { shiftColorCls = 'v-descanso'; icon = ''; label = 'Descanso'; }
            else if (!t || t === '·' || t === '') { shiftColorCls = 'v-empty'; label = '·'; icon = ''; }
        }

        // Si es un sustituto cubriendo a alguien
        if (cellData.isSub) {
            icon = '↔︎';
            cell.title = `Sustituyendo a ${cellData.subFor}`;
        }

        const clsString = `v-cell ${shiftColorCls}`;
        if (cell.className !== clsString) cell.className = clsString;
        
        const displayHTML = `<div class="v-pill">${label} ${icon ? `<small>${icon}</small>` : ''}</div>`;
        if (cell.innerHTML !== displayHTML) cell.innerHTML = displayHTML;
    }

    updateRowOptimistic(payload) {
        this.updateRow(payload);
    }

    rollbackRow(empleado_id, fecha, oldData) {
        const empRow = this.data.find(r => r.empName === empleado_id);
        if(!empRow) return;
        const cellIdx = this.columns.findIndex(c => c.dbFecha === fecha);
        if(cellIdx === -1) return;
        empRow.cells[cellIdx] = { ...oldData };
        this.onScroll();
    }

    updateRow(payloadRow) {
        const empRow = this.data.find(r => r.empName === payloadRow.empleado_id);
        if(!empRow) return;
        const cellIdx = this.columns.findIndex(c => c.dbFecha === payloadRow.fecha);
        if(cellIdx === -1) return;
        empRow.cells[cellIdx].tipo = payloadRow.tipo;
        empRow.cells[cellIdx].turno = payloadRow.turno || '';
        if (payloadRow.sustituto) empRow.cells[cellIdx].sustituto = payloadRow.sustituto;
        this.onScroll(); 
    }
}
window.VirtualTable = VirtualTable;
