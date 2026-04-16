const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\turnosweb - copia\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// The local classify functions to remove (recursive regex)
const regex = /\s+function classify\(raw\) \{[\s\S]+?return '';\s+\}/g;
// We need to be careful not to remove the global one we just added (which is at the top lvl)
// But the local ones are indented.

content = content.replace(/\n    function classify\(raw\) \{[\s\S]+?\n    \}/g, (match, offset) => {
    // Only remove if it's not the one at the start of the file (which has no leading spaces or fewer)
    // Actually, the global one I added has 2 spaces indentation because it's inside (function(){...})
    // The local ones have 4 spaces or more.
    if (match.startsWith('\n    ')) { // 4 spaces
        return '\n    // Removed local classify';
    }
    return match;
});

// Also fix the stats.v calculation in the drawer while we are at it
content = content.replace(/l.startsWith\('v'\) \|\| l.includes\('vacacion'\) \|\| l.startsWith\('b'\) \|\| l.includes\('baja'\) \|\| l.includes\('permiso'\)\) stats.v\+\+;/g, "classify(raw) === 'v' || classify(raw) === 'b') stats.v++;");

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed admin.js');
