const fs = require('fs');
const buf = fs.readFileSync('admin.js');
const content = buf.toString('utf8');
const fmtIdx = content.indexOf('window.fmtDateLegacy');
const returnIdx = content.indexOf('return ', fmtIdx);
if (returnIdx >= 0) {
    const slice = buf.slice(returnIdx, returnIdx + 20);
    console.log('Hex at return statement:', slice.toString('hex'));
    console.log('Latin1:', slice.toString('latin1'));
    const dashBuf = buf.slice(returnIdx + 8, returnIdx + 14);
    console.log('Dash char hex:', dashBuf.toString('hex'));
    // E2 80 94 = proper em dash (U+2014)
    // c3 a2 c2 80 c2 94 = triple-encoded em dash
    // e2 80 9c = left double quote
}
