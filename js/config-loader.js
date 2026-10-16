/* Carrega /config.js (gerado no build do Netlify). Se não existir, usa valores de exemplo.
   Fica em arquivo próprio (e não inline) para a CSP não precisar de 'unsafe-inline'. */
(function(){
  var s = document.createElement('script');
  s.src = '/config.js';
  s.onload = function(){};
  s.onerror = function(){ window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || { url: 'https://your-project.supabase.co', anonKey: 'your-anon-key' }; };
  (document.head || document.documentElement).appendChild(s);
})();
