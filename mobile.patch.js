/* mobile.patch.js (v4)
   Normalización robusta para móvil:
   1) Intenta reparar latin1<->utf8 con decodeURIComponent(escape())
   2) Repara emojis comunes (tabla)
   3) Reemplaza explicitamente mojibake de acentos: á é í ó ú ñ y mayúsculas
*/
window.MobilePatch = (function(){
  const EMOJI_FIX = new Map([
    ["ðŸ–ï¸", "🏖️"], ["🔄", "🔄"], ["🌙", "🌙"], ["✅", "✅"],
    ["â˜€ï¸", "☀️"], ["â˜ƒï¸", "☃️"], ["❌", "❌"], ["â„¹ï¸", "ℹ️"]
  ]);

  // Tabla básica de mojibake común
  const LATIN_MOJI = new Map([
    ["á","á"],["é","é"],["í","í"],["ó","ó"],["ú","ú"],
    ["Ã","Á"],["É","É"],["ÃŒ","Ì"],["Í","Í"],["Ó","Ó"],["Ú","Ú"],
    ["ñ","ñ"],["Ñ","Ñ"],
    ["ü","ü"],["Ü","Ü"],
    ["¿","¿"],["¡","¡"],["Âº","º"],["Âª","ª"],["Â·","·"],["Â°","°"],
    ["â€“","–"],["â€”","—"],["â€˜","‘"],["â€™","’"],["â€œ","“"],["â€","”"],
    ["â€¦","…"],["â€¢","•"],["Â·","·"]
  ]);

  function fixEmojis(s){
    let out = s;
    for(const [bad, good] of EMOJI_FIX) if(out.includes(bad)) out = out.split(bad).join(good);
    return out;
  }
  function fixLatinMojibake(s){
    let out = s;
    for(const [bad, good] of LATIN_MOJI) if(out.includes(bad)) out = out.split(bad).join(good);
    return out;
  }

  function normalize(input){
    if(typeof input !== "string") return input;
    let s = input;
    // 1) Intento latin1->utf8
    try { s = decodeURIComponent(escape(s)); } catch(e){}
    // 2) Emojis rotos
    s = fixEmojis(s);
    // 3) Si aún quedan 'Ã' o caracteres raros, aplicar tabla explícita
    if(s.includes("Ã") || s.includes("Â") || s.includes("â")) s = fixLatinMojibake(s);
    // 4) Espacios
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }
  return { normalize };
})();
