const fs = require('fs');
let admin = fs.readFileSync('admin.js', 'utf8');

const targetStr = `            employeesToRender.forEach(emp => {
                const key = emp.employee_id;
                if (!seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });`;

const replacementStr = `            employeesToRender.forEach(emp => {
                const key = emp.employee_id;
                const rawName = String(emp.nombre || emp.displayName || emp.employee_id || '').trim();
                
                // Ignorar filas separadoras de Excel u omitidas
                if (rawName.includes('---') || rawName.includes('___') || rawName === '' || rawName.toLowerCase() === 'vacante') {
                    return;
                }
                
                if (!seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });`;

admin = admin.replace(targetStr, replacementStr);
fs.writeFileSync('admin.js', admin);
console.log('Fixed deduplicatedList to filter empty/separator rows.');
