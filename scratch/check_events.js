const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read supabase config
const adminJs = fs.readFileSync('admin.html', 'utf-8');
const supabaseUrlMatch = adminJs.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
const supabaseKeyMatch = adminJs.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[0] : '';
// Keys might be in another file or config
console.log('URL:', supabaseUrl);

// Let's search for supabase-config.js
let configContent = '';
if (fs.existsSync('supabase-config.js')) {
    configContent = fs.readFileSync('supabase-config.js', 'utf-8');
} else if (fs.existsSync('supabase.js')) {
    configContent = fs.readFileSync('supabase.js', 'utf-8');
}
console.log('Config length:', configContent.length);

// Let's write a direct query using window.supabase if we run it in browser, or via node.
// We can just use the key if we find it.
const keyMatches = configContent.match(/'(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)'/);
const key = keyMatches ? keyMatches[1] : '';
console.log('Key found:', !!key);
