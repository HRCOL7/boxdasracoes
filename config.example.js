/*
  Copy this file to `config.js` and replace the placeholders with your
  Supabase project values before deploying. Do NOT commit `config.js` to
  a public repo. Alternatively, set these values as environment
  variables in Netlify and create `config.js` at build time.

  Example usage (placed before `js/supabase-client.js`):
  <script src="/config.js"></script>

*/
window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
  url: 'https://your-project.supabase.co', // REPLACE with your Supabase URL
  anonKey: 'your-anon-public-anon-key'     // REPLACE with your anon key
};

// If you prefer Netlify environment variables, you can generate `config.js`
// during the build step using a small script that reads `process.env.SUPABASE_URL`
// and `process.env.SUPABASE_ANON_KEY`.
