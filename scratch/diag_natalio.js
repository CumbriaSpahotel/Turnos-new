
async function diagNatalioSergio() {
    const date = '2026-04-28';
    const hotel = 'Sercotel Guadiana';
    const baseIndex = window._lastBaseIndex;
    const eventos = window._lastEventos;
    
    console.log("--- DIAGNOSTICO NATALIO/SERGIO 28/04 ---");
    
    const resSergio = window.resolveEmployeeDay({
        empleadoId: 'Sergio Sánchez',
        fecha: date,
        turnoBase: 'M',
        eventos: eventos,
        baseIndex: baseIndex
    });
    console.log("Sergio Sánchez:", resSergio);
    
    const resNatalio = window.resolveEmployeeDay({
        empleadoId: 'Natalio',
        fecha: date,
        turnoBase: 'D', // Natalio es D base el 28? No lo sé, pondré D
        eventos: eventos,
        baseIndex: baseIndex
    });
    console.log("Natalio:", resNatalio);
    
    const matchingEvents = eventos.filter(ev => window.eventoAplicaEnFecha(ev, date) && window.eventoPerteneceAEmpleado(ev, 'Natalio', {hotel}));
    console.log("Eventos aplicando a Natalio:", matchingEvents);
}
diagNatalioSergio();
