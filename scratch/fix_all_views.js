/**
 * Fix all views: cache versions, service worker, and publish guard.
 */
const fs = require('fs');
const VERSION = '13.30';
const SW_CACHE = `turnosweb-app-v20260510_2300`;

// 1. Update live.mobile.html script versions
let mobile = fs.readFileSync('live.mobile.html', 'utf8');
const mobileReplacements = [
  ['supabase-config.js?v=9.8', `supabase-config.js?v=${VERSION}`],
  ['supabase-dao.js?v=10.0', `supabase-dao.js?v=${VERSION}`],
  ['turnos-rules.js?v=4.2', `turnos-rules.js?v=${VERSION}`],
  ['shift-resolver.js?v=4.1', `shift-resolver.js?v=${VERSION}`],
  ['turnos-engine.js?v=4.1', `turnos-engine.js?v=${VERSION}`],
  ['excel-loader.js?v=1.0', `excel-loader.js?v=${VERSION}`],
  ['plantilla_mobile_adapter.js?v=10.2', `plantilla_mobile_adapter.js?v=${VERSION}`],
  ['mobile.app.js?v=10.1', `mobile.app.js?v=${VERSION}`],
];
mobileReplacements.forEach(([from, to]) => {
  if (mobile.includes(from)) {
    mobile = mobile.replace(from, to);
    console.log(`[mobile] ${from} -> ${to}`);
  } else {
    console.log(`[mobile] SKIP (not found): ${from}`);
  }
});
fs.writeFileSync('live.mobile.html', mobile, 'utf8');
console.log('[mobile] Updated live.mobile.html');

// 2. Update index.html script version
let index = fs.readFileSync('index.html', 'utf8');
if (index.includes('turnos-rules.js?v=13.22')) {
  index = index.replace('turnos-rules.js?v=13.22', `turnos-rules.js?v=${VERSION}`);
  console.log(`[index] turnos-rules.js?v=13.22 -> ?v=${VERSION}`);
}
fs.writeFileSync('index.html', index, 'utf8');
console.log('[index] Updated index.html');

// 3. Update service worker cache name to bust old caches
let sw = fs.readFileSync('service-worker.js', 'utf8');
const oldCacheMatch = sw.match(/CACHE_NAME\s*=\s*"([^"]+)"/);
if (oldCacheMatch) {
  sw = sw.replace(oldCacheMatch[0], `CACHE_NAME = "${SW_CACHE}"`);
  console.log(`[sw] ${oldCacheMatch[1]} -> ${SW_CACHE}`);
}
fs.writeFileSync('service-worker.js', sw, 'utf8');
console.log('[sw] Updated service-worker.js');

// Also update sw.js registration version in live.mobile.html
mobile = fs.readFileSync('live.mobile.html', 'utf8');
const swRegMatch = mobile.match(/sw\.js\?v=[^'"]+/);
if (swRegMatch) {
  mobile = mobile.replace(swRegMatch[0], `sw.js?v=${VERSION}`);
  fs.writeFileSync('live.mobile.html', mobile, 'utf8');
  console.log(`[mobile] sw.js registration -> ?v=${VERSION}`);
}

console.log('\nAll view files updated.');
