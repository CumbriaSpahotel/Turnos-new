const fs = require('fs');
let c = fs.readFileSync('admin.js', 'utf8');
const lines = c.split('\n');

// Find and replace lines 6445-6449 (0-indexed: 6444-6448)
let start = -1;
for (let i = 6440; i < 6455; i++) {
    if (lines[i] && lines[i].includes("sync-pending-changes')")) {
        start = i;
        break;
    }
}

if (start < 0) {
    console.error('Not found!');
    process.exit(1);
}

// Find the closing }
let end = start;
for (let i = start; i < start + 10; i++) {
    if (lines[i] && lines[i].trim() === '}') {
        end = i;
        break;
    }
}

console.log('Replacing lines', start+1, 'to', end+1);
for (let i = start; i <= end; i++) console.log('  L'+(i+1)+':', lines[i].substring(0,80));

const replacement = [
    "        if ($('#sync-pending-changes')) {",
    "            // Contar eventos activos de la semana del preview (no solo diff de Excel)",
    "            let _pendingCount = 0;",
    "            try {",
    "                const _rawDatePrev = window._previewDate",
    "                    || document.getElementById('prevDateInput')?.value",
    "                    || document.getElementById('datePicker')?.value;",
    "                if (_rawDatePrev && window.TurnosDB && window.TurnosDB.fetchEventos) {",
    "                    const _wS2 = window.isoDate ? window.isoDate(window.getMonday(new Date(_rawDatePrev + 'T12:00:00'))) : _rawDatePrev;",
    "                    const _wE2 = window.addIsoDays ? window.addIsoDays(_wS2, 6) : _wS2;",
    "                    const _evs2 = await window.TurnosDB.fetchEventos(_wS2, _wE2);",
    "                    const _ACT = ['activo','activa','aprobado','aprobada','pendiente'];",
    "                    _pendingCount = (_evs2 || []).filter(e => _ACT.includes(String(e.estado || '').toLowerCase())).length;",
    "                } else { _pendingCount = window.getExcelDiff ? window.getExcelDiff().length : 0; }",
    "            } catch (_ec) { _pendingCount = window.getExcelDiff ? window.getExcelDiff().length : 0; }",
    "            $('#sync-pending-changes').textContent = _pendingCount;",
    "            $('#sync-pending-changes').style.color = _pendingCount > 0 ? '#ef4444' : 'inherit';",
    "        }",
];

lines.splice(start, end - start + 1, ...replacement);
c = lines.join('\n');
fs.writeFileSync('admin.js', c, 'utf8');
console.log('\nDone. New line count:', c.split('\n').length);
