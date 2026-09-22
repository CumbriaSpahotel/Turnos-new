const fs = require("fs");

const content = fs.readFileSync("data/v9_excel_order_map.js", "utf8");
// window._v9_excel_order_data = [ ... ];
const jsonStr = content.replace(/^\ufeff/, "").replace(/^window\._v9_excel_order_data\s*=\s*/, "").replace(/;\s*$/, "");
const data = JSON.parse(jsonStr);

console.log("Total entries in order map:", data.length);

const cumbriaOct12 = data.filter(d => d.hotel === "Cumbria Spa&Hotel" && d.week_start === "2026-10-12");
console.log("Cumbria Oct 12:", cumbriaOct12);

const guadianaOct12 = data.filter(d => d.hotel === "Sercotel Guadiana" && d.week_start === "2026-10-12");
console.log("Guadiana Oct 12:", guadianaOct12);

// Check all unique week_start >= 2026-10-12
const weeksAfter = [...new Set(data.filter(d => d.week_start >= "2026-10-12").map(d => d.week_start))].sort();
console.log("Weeks after 2026-10-12:", weeksAfter);
console.log("Count of weeks after 2026-10-12:", weeksAfter.length);
