const fs = require('fs');

// Fix admin.html
const htmlPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.html';
let html = fs.readFileSync(htmlPath, 'utf8');
const htmlTarget = `<script src="localforage.js"></script>
    <script src="sync-status.js?v=13.8"></script>`;
const htmlReplacement = `<script src="localforage.js"></script>
    <script src="supabase-dao.js?v=13.8"></script>
    <script src="shift-resolver.js?v=13.8"></script>
    <script src="admin.js?v=13.8"></script>
    <script src="sync-status.js?v=13.8"></script>`;

if (html.includes(htmlTarget)) {
    html = html.replace(htmlTarget, htmlReplacement);
    fs.writeFileSync(htmlPath, html);
    console.log("admin.html scripts fixed.");
} else {
    console.log("admin.html target not found.");
}

// Fix admin.js (global employee fetch)
const jsPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

const jsTarget = `(async function fixNataliaTypo() {
    try {
        const emps = await window.TurnosDB.getEmpleados();`;
const jsReplacement = `(async function fixNataliaTypo() {
    try {
        const emps = await window.TurnosDB.getEmpleados();
        window.empleadosGlobales = emps;`;

if (js.includes(jsTarget)) {
    js = js.replace(jsTarget, jsReplacement);
    fs.writeFileSync(jsPath, js);
    console.log("admin.js global emps fixed.");
} else {
    console.log("admin.js target not found.");
}
