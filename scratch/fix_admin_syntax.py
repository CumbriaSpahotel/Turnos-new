import os

path = r'c:\Users\comun\OneDrive\Documentos\GitHub\Turnos-new\admin.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Buscamos el final de la función publishToSupabase que está roto
# Sabemos que está alrededor de la línea 5976
# El bloque roto termina en:
#         }
#     }
# };

# Vamos a buscar la secuencia de líneas
found = False
for i in range(len(lines) - 2):
    if 'if (btn) {' in lines[i] and 'btn.disabled = false;' in lines[i+1] and 'btn.textContent = \'Confirmar y Publicar\';' in lines[i+2]:
        # Hemos encontrado el bloque if (btn)
        # Buscamos el cierre del if y del try
        for j in range(i + 3, len(lines) - 2):
            if '}' in lines[j] and '}' in lines[j+1] and '};' in lines[j+2]:
                # Encontrado el punto de ruptura
                # lines[j] es el cierre de if(btn)
                # lines[j+1] es el cierre de try {
                # lines[j+2] es el cierre de window.publishToSupabase = ...
                
                new_content = [
                    '        }\n',
                    '\n',
                    '        // 4. Actualizar estado local\n',
                    '        window._adminExcelBaseOriginalRows = window.cloneExcelRows(window._adminExcelEditableRows);\n',
                    '        alert("Publicación completada con éxito.");\n',
                    '        document.getElementById("publishPreviewModal")?.classList.remove("open");\n',
                    '        window.renderExcelView();\n',
                    '        window.renderPreview();\n',
                    '        window.renderDashboard();\n',
                    '\n',
                    '    } catch (error) {\n',
                    '        console.error("Error en publicación:", error);\n',
                    '        alert("Error al publicar: " + error.message);\n',
                    '        if (btn) {\n',
                    '            btn.disabled = false;\n',
                    '            btn.textContent = "Confirmar y Publicar";\n',
                    '            btn.style.opacity = "1";\n',
                    '        }\n',
                    '    }\n',
                    '};\n'
                ]
                
                # Reemplazamos desde lines[j] hasta lines[j+2]
                lines[j:j+3] = new_content
                found = True
                break
        if found: break

if found:
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("SUCCESS: Function fixed.")
    
    # Ahora añadimos publishAllCurrentYear al final de esa función
    # publishAllCurrentYear ya fue intentada añadir antes? No, falló el matching.
    # Vamos a insertarla justo después del cierre de la función (que ahora está en lines[j+len(new_content)-1])
    
    extra_function = """
/**
 * Publica todas las semanas del año en curso para todos los hoteles.
 */
window.publishAllCurrentYear = async function() {
    const currentYear = new Date().getFullYear();
    const hotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    const getMondays = (year) => {
        const mondays = [];
        let d = new Date(`${year}-01-01T12:00:00`);
        while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
        while (d.getFullYear() === year) {
            mondays.push(d.toISOString().split('T')[0]);
            d.setDate(d.getDate() + 7);
        }
        return mondays;
    };
    const weeks = getMondays(currentYear);
    const totalOps = weeks.length * hotels.length;
    let done = 0, errors = 0;

    const ok = window.confirm(`¿Publicar año ${currentYear} (${totalOps} ops)?`);
    if (!ok) return;

    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:#1e293b;color:white;padding:16px 24px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:300px;';
    div.innerHTML = `<div>🚀 Publicando año ${currentYear}...</div><div id="pub-year-status" style="color:#94a3b8;margin-top:6px;font-size:0.75rem;">Iniciando...</div><div style="background:#334155;border-radius:10px;height:6px;margin-top:10px;overflow:hidden;"><div id="pub-year-fill" style="background:#3b82f6;height:100%;width:0%;transition:width 0.2s;"></div></div>`;
    document.body.appendChild(div);

    try {
        for (const h of hotels) {
            for (const w of weeks) {
                try {
                    const pct = Math.round((done / totalOps) * 100);
                    const st = document.getElementById('pub-year-status');
                    const fl = document.getElementById('pub-year-fill');
                    if (st) st.textContent = `${h} · ${w} (${done+1}/${totalOps})`;
                    if (fl) fl.style.width = pct + '%';

                    const snaps = await window.buildPublicationSnapshotPreview(w, h);
                    for (const s of (snaps || [])) {
                        await window.TurnosDB.publishCuadranteSnapshot({
                            semanaInicio: s.week_start, semanaFin: s.week_end,
                            hotel: s.hotel_id, snapshot: s,
                            resumen: { emps: (s.rows||[]).length }, usuario: 'ADMIN_YEAR'
                        });
                    }
                } catch(e) { errors++; console.error(e); }
                done++;
                await new Promise(r => setTimeout(r, 60));
            }
        }
        div.remove();
        alert(`Finalizado. ${done - errors} OK, ${errors} errores.`);
        window.renderDashboard();
    } catch(e) {
        div.remove();
        alert('Error: ' + e.message);
    }
};
"""
    with open(path, 'a', encoding='utf-8') as f:
        f.write(extra_function)
    print("SUCCESS: publishAllCurrentYear added.")
else:
    print("ERROR: Block not found.")
