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
        trHead.innerHTML = `<th style="position:sticky; left:0; z-index:20; background:var(--bg3); border-bottom:1px solid var(--border); padding:10px; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">EMPLEADO</th>` + this.columns.map(c => `
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
                <span style="font-size:1rem;">Hotel</span>
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
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; color:var(--accent); font-size:0.9rem;">${rowData.empName}</span>
                </div>
                <div class="emp-badges" style="display:flex; gap:4px;">
                    <span class="emp-badge" style="font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; background:#f8fafc; color:#64748b; border:1px solid #e2e8f0;">N${nights}</span>
                    <span class="emp-badge" style="font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; background:#f8fafc; color:#0d6efd; border:1px solid #e2e8f0;">D${rests}</span>
                </div>
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
            if (rawTurno.includes('mañana') || rawTurno.includes('manana') || rawTurno === 'm') {
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
            } else {
                cleanShiftColorCls = 'v-cambio';
                cleanLabel = 'Cambio';
            }
            cleanIcon = '\u{1F504}';
        } else if (rawTurno.includes('mañana') || rawTurno.includes('manana') || rawTurno === 'm') {
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

        if (cellData.sustituto || cellData.isSub) {
            cleanIcon = '\u{1F504}';
            if (cellData.sustituto) {
                cell.title = `Sustituido por: ${cellData.sustituto}`;
                cleanLabel += ` (${cellData.sustituto.charAt(0).toUpperCase()})`;
            }
            if (cellData.isSub) {
                cell.title = `Sustituyendo a ${cellData.subFor}`;
                cleanLabel += ` (C)`;
            }
        } else {
            cell.title = '';
        }

        const cleanClsString = `v-cell ${cleanShiftColorCls}`;
        if (cell.className !== cleanClsString) cell.className = cleanClsString;
        const cleanDisplayHTML = `<div class="v-pill">${cleanLabel}${cleanIcon ? ` <small>${cleanIcon}</small>` : ''}</div>`;
        if (cell.innerHTML !== cleanDisplayHTML) cell.innerHTML = cleanDisplayHTML;
        return;
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
