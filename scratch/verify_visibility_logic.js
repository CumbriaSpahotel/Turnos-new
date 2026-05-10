const employee = {
  "dias": {
    "2026-10-19": { "code": "T" },
    "2026-10-21": { "code": "Mañana" }
  },
  "cells": {
    "2026-10-19": { "code": "T" },
    "2026-10-21": { "code": "Mañana" }
  },
  "nombre": "Próximamente",
  "rowType": "operativo",
  "empleado_id": "¿?"
};

const isPublicEmployeeVisible = (employee) => {
    if (!employee) return false;
    
    const name = String(employee.nombre || employee.nombreVisible || employee.name || employee.empleado || '').trim().toLowerCase();
    const id = String(employee.empleado_id || employee.id || '').trim().toLowerCase();

    const daysMap = employee.turnosOperativos || employee.cells || employee.dias || {};
    const turns = Object.values(daysMap);
    const hasOperationalTurns = turns.some(t => {
        const code = String(t.code || t.turno || t.turnoFinal || '').toUpperCase();
        return code && code !== '—' && code !== '' && code !== 'SIN_TURNO';
    });

    const isProximamente = name.includes('proximamente') || name.includes('próximamente');
    if (isProximamente && hasOperationalTurns) return true;

    if (name === 'vacante' || name.includes('vacante') || id === 'vacante') return false;
    if ((name === '¿?' || id === '¿?') && !isProximamente) return false;

    return true;
};

console.log('Is Próximamente visible?', isPublicEmployeeVisible(employee));
