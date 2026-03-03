// build-config.js
// Writes config.js from environment variables during Netlify build
const fs = require('fs');
const url = process.env.SUPABASE_URL || '';
const anon = process.env.SUPABASE_ANON_KEY || '';
const out = `window.SUPABASE_CONFIG = { url: '${url.replace(/'/g,"\\'")}', anonKey: '${anon.replace(/'/g,"\\'")}' };\n`;
try{
  fs.writeFileSync('config.js', out, { encoding: 'utf8' });
  console.log('config.js written');
}catch(err){ console.error('Failed to write config.js', err); process.exit(1); }