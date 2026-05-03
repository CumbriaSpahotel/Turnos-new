// Simulate V139 enrichment + sort on V138 snapshot to verify Miriam position
const {createClient} = require('../temp_node/node_modules/@supabase/supabase-js');
const sb = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

const profiles = [
  {id:'Natalio',nombre:'Natalio',tipo_personal:'ocasional',orden:0,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Antonio',nombre:'Antonio',tipo_personal:'fijo',orden:1,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Cristina',nombre:'Cristina',tipo_personal:'fijo',orden:2,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Valentín',nombre:'Valentín',tipo_personal:'fijo',orden:3,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Isabel Hidalgo',nombre:'Isabel Hidalgo',tipo_personal:'apoyo',orden:4,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Gustavo Sánchez',nombre:'Gustavo Sánchez',tipo_personal:'ocasional',orden:5,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Esther',nombre:'Esther',tipo_personal:'fijo',orden:6,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Miriam',nombre:'Miriam',tipo_personal:'ocasional',orden:7,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Sergio',nombre:'Sergio',tipo_personal:'fijo',orden:8,hotel_id:'Cumbria Spa&Hotel'},
  {id:'Diana',nombre:'Diana',tipo_personal:'fijo',orden:0,hotel_id:'Sercotel Guadiana'},
  {id:'Dani',nombre:'Dani',tipo_personal:'fijo',orden:1,hotel_id:'Sercotel Guadiana'},
  {id:'Macarena',nombre:'Macarena',tipo_personal:'fijo',orden:2,hotel_id:'Sercotel Guadiana'},
  {id:'Federico',nombre:'Federico',tipo_personal:'fijo',orden:3,hotel_id:'Sercotel Guadiana'},
  {id:'Sergio Sánchez',nombre:'Sergio Sánchez',tipo_personal:'apoyo',orden:5,hotel_id:'Sercotel Guadiana'},
];

sb.from('publicaciones_cuadrante').select('snapshot_json,semana_inicio,hotel').eq('version',138).order('semana_inicio').then(({data,error}) => {
  if(error){console.error(JSON.stringify(error));process.exit(1);}
  (data||[]).forEach(snapRow => {
    const snap = typeof snapRow.snapshot_json==='string'?JSON.parse(snapRow.snapshot_json):snapRow.snapshot_json;
    const rows = JSON.parse(JSON.stringify(snap.rows||[])); // deep copy

    // Apply V139 enrichment
    rows.forEach((row, idx) => {
      const empId = String(row.empleado_id || row.nombre || '').trim();
      const profile = profiles.find(p => String(p.id||'').trim()===empId || String(p.nombre||'').trim()===empId);
      if (profile) {
        row.tipo = row.tipo || profile.tipo_personal || 'fijo';
        row.tipoPersonal = profile.tipo_personal || 'fijo';
        row.excludeCounters = profile.tipo_personal.includes('apoyo') || profile.tipo_personal.includes('ocasional');
        if (row.puestoOrden === 500 || row.puestoOrden === undefined || row.puestoOrden === null) {
          if (row.rowType === 'ausencia_informativa') {
            row.puestoOrden = (profile.orden !== null ? Number(profile.orden) : idx) + 1000;
          } else if (row.titularOriginalId) {
            const tp = profiles.find(p => String(p.id||'').trim()===String(row.titularOriginalId).trim() || String(p.nombre||'').trim()===String(row.titularOriginalId).trim());
            row.puestoOrden = tp && tp.orden !== null ? Number(tp.orden) : idx;
          } else {
            row.puestoOrden = profile.orden !== null ? Number(profile.orden) : idx;
          }
        }
        row.orden = row.puestoOrden;
      } else {
        row.puestoOrden = row.puestoOrden !== 500 ? (row.puestoOrden || idx) : idx;
        row.excludeCounters = row.excludeCounters || false;
      }
    });

    // Re-sort
    rows.sort((a,b) => {
      const absA = a.rowType === 'ausencia_informativa';
      const absB = b.rowType === 'ausencia_informativa';
      if (absA !== absB) return absA ? 1 : -1;
      const oA = Number(a.puestoOrden ?? 9999);
      const oB = Number(b.puestoOrden ?? 9999);
      if (oA !== oB) return oA - oB;
      return (a.tipoPersonal === 'fijo' ? 0 : 1) - (b.tipoPersonal === 'fijo' ? 0 : 1);
    });

    console.log('=== '+snapRow.hotel+' | '+snapRow.semana_inicio+' | V139 order ===');
    rows.forEach((r,i) => {
      const isSub = r.titularOriginalId ? ' [sust->'+r.titularOriginalId+']' : '';
      const excl = r.excludeCounters ? ' [NO_COUNTER]' : '';
      const abs = r.rowType === 'ausencia_informativa' ? ' [AUSENTE]' : '';
      console.log(i+': puestoOrden='+r.puestoOrden+' | '+r.nombre+excl+isSub+abs);
    });
  });
  setTimeout(()=>process.exit(0),500);
});

