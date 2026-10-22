(function(){
  'use strict';
  // Preenche <span data-info="campo"> com os dados de js/site-info.js; vazio vira aviso amarelo "[a preencher]".
  var I = window.SITE_INFO || {};
  var NAMES = { razaoSocial: 'razão social', cnpj: 'CNPJ', endereco: 'endereço', email: 'e-mail de contato', emailPrivacidade: 'e-mail de privacidade', encarregado: 'responsável por privacidade', foro: 'cidade do foro', horario: 'horário' };
  function fill(){
    document.querySelectorAll('[data-info]').forEach(function(el){
      var k = el.getAttribute('data-info'), v = k === '__wa' ? I.whatsappTexto : I[k];
      if(v){ el.textContent = v; el.classList.remove('is-pending'); }
      else { var m = document.createElement('mark'); m.className = 'pending'; m.textContent = '[a preencher: ' + (NAMES[k] || k) + ']'; el.textContent = ''; el.appendChild(m); }
    });
    document.querySelectorAll('[data-info-mail]').forEach(function(a){
      var v = I[a.getAttribute('data-info-mail')] || I.email;
      if(v){ a.href = 'mailto:' + v; a.textContent = v; } else { a.removeAttribute('href'); var m = document.createElement('mark'); m.className = 'pending'; m.textContent = '[a preencher: e-mail]'; a.textContent = ''; a.appendChild(m); }
    });
    var u = document.querySelector('[data-updated]'); if(u && I.atualizadoEm) u.textContent = I.atualizadoEm;
    document.querySelectorAll('[data-open-cookies]').forEach(function(b){ b.addEventListener('click', function(){ if(window.cookieConsent && window.cookieConsent.open) window.cookieConsent.open(); }); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
