const fs = require('fs');
const path = require('path');

// Mock de window.TurnosRules
global.window = {};

// Cargar turnos-rules.js manualmente evaluando el código (porque es un IIFE que asigna a window)
const rulesPath = path.join(__dirname, '../turnos-rules.js');
const rulesCode = fs.readFileSync(rulesPath, 'utf8');
eval(rulesCode);

// Simulación de los datos del snapshot diagnosticados
const dianaCell = {
  "code": "M",
  "icons": [],
  "label": "M",
  "estado": "operativo",
  "origen": "INTERCAMBIO_TURNO",
  "sustituto": null,
  "titular_cubierto": null
};

const daniCell = {
  "code": "N",
  "icons": [],
  "label": "N",
  "estado": "operativo",
  "origen": "INTERCAMBIO_TURNO",
  "sustituto": null,
  "titular_cubierto": null
};

const dianaDisplay = global.window.TurnosRules.getPublicCellDisplay(dianaCell);
const daniDisplay = global.window.TurnosRules.getPublicCellDisplay(daniCell);

console.log('--- DIAGNÓSTICO RENDER (POST-FIX) ---');
console.log('Diana 04/05 Display:', JSON.stringify(dianaDisplay, null, 2));
console.log('Dani 04/05 Display:', JSON.stringify(daniDisplay, null, 2));

const dianaHasIcon = dianaDisplay.icons.includes('🔄');
const daniHasIcon = daniDisplay.icons.includes('🔄');

if (dianaHasIcon && daniHasIcon) {
    console.log('RESULTADO: OK - Ambas celdas muestran el icono 🔄');
} else {
    console.log('RESULTADO: ERROR - Faltan iconos');
}
