
async function testTables() {
    const tables = ['empleados', 'turnos', 'eventos_cuadrante', 'hoteles', 'cambios_turno'];
    for (const t of tables) {
        try {
            const { error } = await window.supabase.from(t).select('count', { count: 'exact', head: true });
            if (error) {
                console.log(`[TABLE TEST] ${t}: ERROR ${error.code} - ${error.message}`);
            } else {
                console.log(`[TABLE TEST] ${t}: OK`);
            }
        } catch (e) {
            console.log(`[TABLE TEST] ${t}: FETCH FAILED`);
        }
    }
}
testTables();
