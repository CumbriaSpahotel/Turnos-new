
const https = require('https');

const url = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1/publicaciones_cuadrante?select=version&order=version.desc&limit=1";
const options = {
  headers: {
    'apikey': 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ',
    'Authorization': 'Bearer sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('LATEST_VERSION_RAW:', data);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
