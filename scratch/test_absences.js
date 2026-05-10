
const fs = require('fs');
const path = require('path');

// Mock window object for TurnosRules
global.window = {};
require('../turnos-rules.js');

const rules = global.window.TurnosRules;

function test() {
    console.log("--- INICIANDO TESTS ANTIRREGRESIÓN ---");
    
    // CASO 1 & 2: Labels
    const bDef = rules.definitions.b;
    const pDef = rules.definitions.p;
    
    console.log(`Baja label: ${bDef.label} (Esperado: Baja 🩺)`);
    console.log(`Permiso label: ${pDef.label} (Esperado: Permiso 🗓️)`);
    
    if (bDef.label !== 'Baja 🩺') throw new Error("Label de Baja incorrecto");
    if (pDef.label !== 'Permiso 🗓️') throw new Error("Label de Permiso incorrecto");
    
    // Estilos
    console.log(`Baja style: ${bDef.adminStyle}`);
    if (!bDef.adminStyle.includes('#f3e8ff')) throw new Error("Fondo de Baja no es lila");
    
    // CASO 3, 4, 5: Pin logic
    const mockBajaSub = {
        isCoverageMarker: true,
        tipoAusencia: 'BAJA',
        turnoFinal: 'M'
    };
    const mockPermSub = {
        isCoverageMarker: true,
        tipoAusencia: 'PERMISO',
        turnoFinal: 'T'
    };
    const mockVacSub = {
        isCoverageMarker: true,
        tipoAusencia: 'VACACIONES',
        turnoFinal: 'M'
    };
    
    console.log(`Pin para Sustituto de Baja: ${rules.shouldShowPin(mockBajaSub)} (Esperado: true)`);
    console.log(`Pin para Sustituto de Permiso: ${rules.shouldShowPin(mockPermSub)} (Esperado: true)`);
    console.log(`Pin para Sustituto de Vacaciones: ${rules.shouldShowPin(mockVacSub)} (Esperado: false)`);
    
    if (!rules.shouldShowPin(mockBajaSub)) throw new Error("Pin falló en Baja");
    if (!rules.shouldShowPin(mockPermSub)) throw new Error("Pin falló en Permiso");
    if (rules.shouldShowPin(mockVacSub)) throw new Error("Pin erróneo en Vacaciones");

    console.log("--- TESTS COMPLETADOS CON ÉXITO ---");
}

try {
    test();
} catch (e) {
    console.error("FAIL:", e.message);
    process.exit(1);
}
