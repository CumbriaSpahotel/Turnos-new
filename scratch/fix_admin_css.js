const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\admin.css';
let content = fs.readFileSync(path, 'utf8');

const goodPillSection = `.emp-badge {
  font-size: 0.65rem;
  padding: 2px 6px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-weight: 700;
  color: #64748b;
  white-space: nowrap;
}

/* TURNOS CELLS */
.v-cell { transition: background 0.2s; }
.v-cell:hover { background: #f1f5f9; }

/* REGLA MAESTRA: Colores de turnos en Admin Virtualizer */
.v-mañana  { background: #ebfbee !important; color: #2f9e44 !important; border: 1px solid #d3f9d8 !important; }
.v-tarde   { background: #fff9db !important; color: #f08c00 !important; border: 1px solid #ffec99 !important; }
.v-noche   { background: #edf2ff !important; color: #364fc7 !important; border: 1px solid #dbe4ff !important; }
.v-descanso { background: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fecaca !important; }
.v-vac     { background: #e3f2fd !important; color: #0277bd !important; border: 1px solid #b3e5fc !important; }
.v-baja    { background: #f3e8ff !important; color: #581c87 !important; border: 1px solid #d8b4fe !important; }
.v-perm    { background: #f3e8ff !important; color: #581c87 !important; border: 1px solid #d8b4fe !important; }
.v-cambio  { background: #fff7ed !important; color: #c2410c !important; border: 1px solid #fdba74 !important; }
.v-empty   { background: #f8fafc !important; color: #64748b !important; border: 1px solid #e2e8f0 !important; }

.v-pill {
  width: 100%;
  padding: 6px 4px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 32px;
}`;

// Fix the mangled section at 1397
const badSectionRegex = /\.emp-badge \{\s*font-size: 0\.65rem;\s*padding: 2px 6px;\s*background: white;\s*border: 1px solid #e2e8f0;\s*border-radius: 4px;\s*font-weight: 700;\s*font-size: 0\.8rem;\s*font-weight: 700;\s*text-align: center;\s*border: 1px solid transparent;\s*display: flex;\s*align-items: center;\s*justify-content: center;\s*gap: 4px;\s*min-height: 32px;\s*\}/g;

content = content.replace(badSectionRegex, goodPillSection);

// Fix the dangling header if it exists
content = content.replace(/\.emp-line-header\.advanced,\s*\.emp-line-header\.advanced,/g, '.emp-line-header.advanced,');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed admin.css');
