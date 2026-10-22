(function(){
  'use strict';
  // Rodapé único para todas as páginas do site (dados vêm de js/site-info.js).
  if(document.querySelector('.site-footer')) return;
  var I = window.SITE_INFO || {};
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  var id = [I.razaoSocial, I.cnpj ? 'CNPJ ' + I.cnpj : ''].filter(Boolean).join(' · ');
  var col1 = '<section aria-labelledby="ft-loja"><h2 id="ft-loja">' + esc(I.nomeFantasia || 'Box das Rações') + '</h2><p>Rações, medicamentos e acessórios para o seu pet.</p>'
    + (id ? '<p class="ft-id">' + esc(id) + '</p>' : '') + (I.endereco ? '<p class="ft-addr">' + esc(I.endereco) + '</p>' : '') + '</section>';
  var col2 = I.horario ? '<section aria-labelledby="ft-hor"><h2 id="ft-hor">Horário</h2><p>' + esc(I.horario) + '</p></section>' : '';
  var wa = I.whatsappNumero ? '<p><a href="https://wa.me/' + esc(I.whatsappNumero) + '" target="_blank" rel="noopener noreferrer">WhatsApp ' + esc(I.whatsappTexto || '') + '<span class="sr-only"> (abre em nova aba)</span></a></p>' : '';
  var mail = I.email ? '<p><a href="mailto:' + esc(I.email) + '">' + esc(I.email) + '</a></p>' : '';
  var col3 = '<section aria-labelledby="ft-cont"><h2 id="ft-cont">Contato</h2>' + wa + mail + '<p><a href="/products.html">Todos os produtos</a></p></section>';
  var legal = '<nav class="ft-legal" aria-label="Informações legais"><ul>'
    + '<li><a href="/privacidade.html">Política de Privacidade</a></li>'
    + '<li><a href="/termos.html">Termos de Uso</a></li>'
    + '<li><a href="/cookies.html">Política de Cookies</a></li>'
    + '<li><a href="/trocas-e-reembolso.html">Trocas e Reembolso</a></li>'
    + '<li><button type="button" class="ft-cookie-btn" id="ft-cookie-prefs">Preferências de cookies</button></li></ul></nav>';
  var f = document.createElement('footer');
  f.className = 'site-footer'; f.setAttribute('aria-label', 'Rodapé');
  f.innerHTML = '<div class="footer-grid">' + col1 + col2 + col3 + '</div>' + legal
    + '<p class="ft-copy">© ' + new Date().getFullYear() + ' ' + esc(I.nomeFantasia || 'Box das Rações') + '. Imagens de produtos são ilustrativas.</p>';
  var main = document.querySelector('main');
  if(main && main.parentNode) main.parentNode.insertBefore(f, main.nextSibling); else document.body.appendChild(f);
  var b = f.querySelector('#ft-cookie-prefs');
  if(b) b.addEventListener('click', function(){ if(window.cookieConsent && window.cookieConsent.open) window.cookieConsent.open(); else location.href = '/cookies.html'; });
})();
