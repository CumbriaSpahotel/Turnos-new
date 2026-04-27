const fs = require('fs');
const jsPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

// Eliminar duplicados de $ y $$
js = js.replace(/const \$ = window\.\$;\r?\nconst \$\$ = window\.\$\$;/g, '');
// Asegurarse de que window.$ y window.$$ existan una sola vez de forma segura
js = js.replace(/window\.\$ = \(s\) => document\.querySelector\(s\);/g, 'if (!window.$) window.$ = (s) => document.querySelector(s);');
js = js.replace(/window\.\$\$ = \(s\) => document\.querySelectorAll\(s\);/g, 'if (!window.$$) window.$$ = (s) => document.querySelectorAll(s);');

fs.writeFileSync(jsPath, js);
console.log("admin.js syntax fixed.");
