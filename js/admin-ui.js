/* Enhancements for admin UI: image preview, edit/delete, search filter */
(function(){
  function qs(s){return document.querySelector(s)}
  document.addEventListener('DOMContentLoaded',()=>{
    function readProducts(){ try{ return JSON.parse(localStorage.getItem('products')||'[]'); }catch(e){ console.error('Failed to parse products from localStorage', e); return []; } }
    // limits to prevent localStorage quota exhaustion
    const MAX_IMAGE_FILE_BYTES = 5000000; // 5,000,000 bytes (~4.77 MB)
    const MAX_IMAGE_DATAURL_LENGTH = 5000000; // same threshold for pasted data: URLs
        function formatFileSizeLimit(bytes){
          if(bytes >= 1024 * 1024){
            return (Math.round((bytes / (1024 * 1024)) * 10) / 10) + 'MB';
          }
          return Math.round(bytes/1024) + 'KB';
        }

    const MAX_VIDEO_FILE_BYTES = 5000000; // 5,000,000 bytes (~4.77 MB)
    const MAX_VIDEO_DATAURL_LENGTH = 5000000;
    const imageUrls = qs('#image-urls'); const imagesHidden = qs('#images-hidden'); const preview = qs('#image-preview'); const fileInput = qs('#image-file'); const illustrativeChk = qs('#image-illustrative');
    const videoUrl = qs('#video-url'); const videoPreview = qs('#video-preview'); const videoFile = qs('#video-file');
    let imagesFromFiles = [];
    function getConfiguredGroups(){
      const defaults = [
        {title:'CÃES', subs:['Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza']},
        {title:'GATOS', subs:['Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza']},
        {title:'OUTROS', subs:['Peixes','Aves','Roedores']},
        {title:'MEDICAMENTOS', subs:['Antibióticos','Antifúngicos','Anti-inflamatórios','Analgésicos','Suplementos e Vitaminas','Dermatológicos','Antiparasitários']},
        {title:'PROMOÇÕES', subs:[]}
      ];
      try{
        if(window.appUtils && typeof window.appUtils.getSiteSettings === 'function'){
          const cfg = window.appUtils.getSiteSettings();
          if(cfg && Array.isArray(cfg.categories) && cfg.categories.length){
            return cfg.categories.map(c=>({ title: String(c.title||'').trim(), subs: Array.isArray(c.subs) ? c.subs : [] })).filter(c=>c.title);
          }
        }
      }catch(e){}
      return defaults;
    }
    let groups = getConfiguredGroups();
    // populate selects
    const groupSelect = qs('#group-select'); const subgroupSelect = qs('#subgroup-select');
    function populateGroupsSelect(selected){
      if(!groupSelect) return;
      const current = typeof selected === 'string' ? selected : (groupSelect.value || '');
      groupSelect.innerHTML = '<option value="">(selecionar)</option>';
      groups.forEach(g=>{ const o = document.createElement('option'); o.value = g.title; o.textContent = g.title; groupSelect.appendChild(o); });
      if(current && Array.from(groupSelect.options).some(o=>o.value===current)) groupSelect.value = current;
    }
    populateGroupsSelect();
    function getSavedSubgroups(selectedGroup){
      const products = readProducts();
      const set = new Set();
      products.forEach(p=>{
        if(!p) return;
        if(selectedGroup){ if(p.group === selectedGroup && p.subgroup) set.add(p.subgroup); }
        else if(p.subgroup) set.add(p.subgroup);
      });
      return Array.from(set).sort();
    }

    function populateSubgroups(selected){
      if(!subgroupSelect) return;
      subgroupSelect.innerHTML = '<option value="">(selecionar)</option>';
      const g = groups.find(x=>x.title===selected);
      const added = new Set();
      if(g && g.subs && g.subs.length){ g.subs.forEach(s=>{ if(!added.has(s)){ const o = document.createElement('option'); o.value = s; o.textContent = s; subgroupSelect.appendChild(o); added.add(s); } }); }
      // add any subgroups found in saved products (for the selected group if provided, else all)
      const saved = getSavedSubgroups(selected);
      saved.forEach(s=>{ if(!added.has(s)){ const o = document.createElement('option'); o.value = s; o.textContent = s; subgroupSelect.appendChild(o); added.add(s); } });
    }
    if(groupSelect){ groupSelect.addEventListener('change',()=>{ populateSubgroups(groupSelect.value); }); }

    document.addEventListener('site-settings-updated', ()=>{
      const previousGroup = groupSelect ? groupSelect.value : '';
      const previousSub = subgroupSelect ? subgroupSelect.value : '';
      groups = getConfiguredGroups();
      populateGroupsSelect(previousGroup);
      populateSubgroups(groupSelect ? groupSelect.value : '');
      if(subgroupSelect && previousSub && Array.from(subgroupSelect.options).some(o=>o.value===previousSub)){
        subgroupSelect.value = previousSub;
      }
    });

    function renderImagePreviews(list){
      if(!preview) return;
      preview.innerHTML = '';
      if(!list || !list.length){ preview.style.display = 'none'; return }
      list.forEach((src, i)=>{
        const wrap = document.createElement('div'); wrap.style.display = 'inline-flex'; wrap.style.flexDirection = 'column'; wrap.style.alignItems = 'center'; wrap.style.marginRight = '8px'; wrap.style.gap = '6px';
        wrap.dataset.index = String(i);
        const img = document.createElement('img'); img.src = src; img.alt = 'imagem '+(i+1); img.style.width='96px'; img.style.height='96px'; img.style.objectFit='cover'; img.style.borderRadius='6px';
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'remove-image btn'; btn.textContent = 'Remover'; btn.dataset.index = String(i); btn.style.fontSize = '12px'; btn.style.padding = '6px 8px';
        wrap.appendChild(img);
        wrap.appendChild(btn);
        preview.appendChild(wrap);
      });
      preview.style.display = 'block';
    }

    // remove a single image by combined index (URLs first, then uploaded files)
    function removeImageAt(index){
      try{
        const urls = (imageUrls && imageUrls.value) ? imageUrls.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : [];
        if(index < urls.length){
          urls.splice(index,1);
          if(imageUrls) imageUrls.value = urls.join('\n');
        } else {
          const fileIdx = index - urls.length;
          if(Array.isArray(imagesFromFiles) && imagesFromFiles.length > fileIdx){
            imagesFromFiles.splice(fileIdx,1);
          }
        }
        updateImagesField();
        renderImagePreviews(getCombinedImages());
      }catch(e){ console.error('Erro ao remover imagem', e); }
    }

    // delegate clicks on remove buttons inside preview
    if(preview){
      preview.addEventListener('click', (ev)=>{
        const btn = ev.target.closest && ev.target.closest('button.remove-image');
        if(btn){ const idx = Number(btn.dataset.index); if(!Number.isNaN(idx)) removeImageAt(idx); }
      });
    }
    // live preview for garantia (nutritional table)
    const garantiaField = qs('[name="garantia"]');
    const garantiaPreview = qs('#garantia-preview');
    function updateGarantiaPreview(){
      if(!garantiaPreview) return;
      try{ garantiaPreview.innerHTML = window.buildGarantiaHtml(garantiaField ? garantiaField.value : ''); }
      catch(e){ garantiaPreview.textContent = String(garantiaField ? garantiaField.value : ''); }
    }
    if(garantiaField){ garantiaField.addEventListener('input', updateGarantiaPreview); }
    // initialize preview on load
    updateGarantiaPreview();
    // file input -> convert to dataURL and set previews and hidden images field
    if(fileInput && preview && imagesHidden){
      fileInput.addEventListener('change',()=>{
        let files = Array.from(fileInput.files || []);
        if(files.length === 0){ imagesFromFiles = []; updateImagesField(); renderImagePreviews([]); return; }
        const allowed = ['image/png','image/jpeg','image/webp'];
        // filter out unsupported types and oversized files early
        files = files.filter(f=>{
          if(!allowed.includes(f.type)){
            alert('Formato não suportado. Use PNG, JPEG ou WEBP. Arquivo ignorado: ' + (f.name || ''));
            return false;
          }
          if(f.size > MAX_IMAGE_FILE_BYTES){
            alert('Arquivo muito grande. Máx ' + formatFileSizeLimit(MAX_IMAGE_FILE_BYTES) + '. Arquivo ignorado: ' + (f.name || ''));
            return false;
          }
          return true;
        });
        if(files.length === 0){ return; }
        const readers = files.map(f=> new Promise((res,rej)=>{
          const r = new FileReader(); r.onload = ()=> res(String(r.result)); r.onerror = ()=> rej(new Error('Erro ao ler arquivo')); r.readAsDataURL(f);
        }));
        Promise.allSettled(readers).then(results=>{
          const newFiles = results.filter(r=>r.status==='fulfilled').map(r=>r.value);
          // append new files to existing list (user may select files multiple times)
          imagesFromFiles = (imagesFromFiles || []).concat(newFiles);
          // enforce max and update UI
          updateImagesField();
          renderImagePreviews(getCombinedImages());
        }).catch(err=>{ alert('Erro ao ler imagens: '+String(err)); });
      });
    }

    // remove images button: clears URLs, hidden field, file input and preview
    const removeImagesBtn = qs('#remove-images');
    if(removeImagesBtn){
      removeImagesBtn.addEventListener('click', ()=>{
        if(!confirm('Remover todas as imagens deste produto?')) return;
        if(imageUrls) imageUrls.value = '';
        imagesFromFiles = [];
        if(fileInput) fileInput.value = '';
        if(imagesHidden) imagesHidden.value = JSON.stringify([]);
        renderImagePreviews([]);
      });
    }

    // video file -> convert to dataURL (warning: may be large)
    if(videoFile && videoPreview && videoUrl){
      videoFile.addEventListener('change',()=>{
        const f = videoFile.files && videoFile.files[0]; if(!f) return;
        if(!f.type || !f.type.startsWith('video/')){ alert('Formato não suportado. Envie um arquivo de vídeo.'); videoFile.value=''; return; }
        if(f.size > MAX_VIDEO_FILE_BYTES){ alert('Vídeo muito grande. Use um link externo (YouTube/Vimeo) ou um arquivo menor.'); videoFile.value=''; return; }
        const r = new FileReader();
        r.onload = ()=>{ try{ const data = String(r.result || ''); if(data.length > MAX_VIDEO_DATAURL_LENGTH){ alert('Vídeo convertido é muito grande para armazenamento local; use link externo.'); videoFile.value=''; return; } videoUrl.value = data; videoPreview.src = data; videoPreview.style.display = 'block'; }catch(e){} };
        r.onerror = ()=>{ alert('Erro ao ler o arquivo de vídeo.'); };
        r.readAsDataURL(f);
      });
    }

    // remove video button: clears url, file input and preview
    const removeVideoBtn = qs('#remove-video');
    if(removeVideoBtn){
      removeVideoBtn.addEventListener('click', ()=>{
        if(!confirm('Remover o vídeo deste produto?')) return;
        if(videoUrl) videoUrl.value = '';
        if(videoFile) videoFile.value = '';
        if(videoPreview){ videoPreview.src = ''; videoPreview.style.display = 'none'; }
      });
    }

    if(imageUrls && imagesHidden){
      imageUrls.addEventListener('input', ()=>{ updateImagesField(); renderImagePreviews(getCombinedImages()); });
    }

    function getCombinedImages(){
      const urls = (imageUrls && imageUrls.value) ? imageUrls.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : [];
      return urls.concat(imagesFromFiles);
    }

    function updateImagesField(){
      if(!imagesHidden) return;
      // enforce max 7 images total (URLs + uploaded files)
      let urls = (imageUrls && imageUrls.value) ? imageUrls.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : [];
      // filter out pasted data: URLs that are too long
      urls = urls.filter(u=>{
        if(String(u||'').indexOf('data:') === 0 && String(u).length > MAX_IMAGE_DATAURL_LENGTH){
          // warn once (don't spam for every URL)
          try{ alert('Algumas data-URLs são muito grandes e foram removidas. Use links ou arquivos menores.'); }catch(e){}
          return false;
        }
        return true;
      });
      let files = imagesFromFiles || [];
      let combined = urls.concat(files);
      if(combined.length > 7){
        alert('Máximo 7 imagens por produto. Serão usadas as primeiras 7 imagens.');
        // keep first up to 7: prefer keeping URLs first then files
        const keepUrls = urls.slice(0,7);
        const remaining = Math.max(0, 7 - keepUrls.length);
        const keepFiles = files.slice(0, remaining);
        // update sources to trimmed lists
        urls = keepUrls;
        imagesFromFiles = keepFiles;
        if(imageUrls) imageUrls.value = urls.join('\n');
        combined = urls.concat(imagesFromFiles);
      }
      imagesHidden.value = JSON.stringify(combined);
    }

    // delete and edit buttons via event delegation
    const list = qs('#admin-products');
    if(list){
      list.addEventListener('click',e=>{
        const del = e.target.closest('.btn-delete');
        const edit = e.target.closest('.btn-edit');
        if(del){ const id = Number(del.dataset.id); const products = readProducts(); const idx = products.findIndex(p=>p.id===id); if(idx>-1){ products.splice(idx,1); localStorage.setItem('products',JSON.stringify(products)); document.dispatchEvent(new CustomEvent('products-updated')); }}
        if(edit){
          const id = Number(edit.dataset.id);
          const products = readProducts();
          const p = products.find(x=>x.id===id);
          if(p){
            const form = document.getElementById('product-form');
            form.name.value = p.name;
            // set price field to first variant price if available
            if(Array.isArray(p.variants) && p.variants.length){ form.price.value = p.variants[0].price; }
            else { form.price.value = p.price || 0 }
            form.group.value = p.group;
            // populate subgroups for this group
            populateSubgroups(p.group);
            form.brand.value = p.brand;
            form.subgroup.value = p.subgroup;
            // populate variants textarea
            const variantsField = form.querySelector('[name="variants"]');
            if(variantsField){
              if(Array.isArray(p.variants) && p.variants.length){
                variantsField.value = p.variants.map(v=>`${v.weight},${v.price}`).join('\n');
              } else {
                variantsField.value = p.variant || '';
              }
            }
            // populate images: fill image URLs textarea and hidden images JSON
            if(imageUrls) imageUrls.value = (Array.isArray(p.images) && p.images.length) ? p.images.join('\n') : (p.image || '');
            if(imagesHidden) imagesHidden.value = JSON.stringify((Array.isArray(p.images) && p.images.length) ? p.images : (p.image ? [p.image] : []));
            imagesFromFiles = [];
            // render previews from images array
            try{ const imgs = (Array.isArray(p.images) && p.images.length) ? p.images : (p.image ? [p.image] : []); renderImagePreviews(imgs); } catch(e){}
            // populate video fields if present
            if(form.video) form.video.value = p.video || '';
            if(videoPreview){ videoPreview.src = p.video || ''; videoPreview.style.display = p.video ? 'block' : 'none'; }
            // set illustrative checkbox
            if(illustrativeChk) illustrativeChk.checked = !!p.image_illustrative;
            form.internal.value = p.internal||'';
            // populate new fields
            if(form.description) form.description.value = p.description || '';
            if(form.garantia) form.garantia.value = p.garantia_raw || (p.garantia || '');
            // update live preview when loading an existing product
            setTimeout(()=>{ if(typeof window.buildGarantiaHtml === 'function'){ const gv = form.garantia.value||''; const prev = document.getElementById('garantia-preview'); if(prev) prev.innerHTML = window.buildGarantiaHtml(gv); } }, 20);
            const previewEl = document.getElementById('image-preview'); if(previewEl){ /* handled above */ }
            // clear file input value
            if(fileInput) fileInput.value = '';
            form.dataset.editId = id;
          }
        }
      });
    }

    // handle search in admin tools
    const adminSearch = qs('#admin-search'); if(adminSearch){
      adminSearch.addEventListener('input',()=>{
        const q = adminSearch.value.trim().toLowerCase(); const products = readProducts();
        const out = products.filter(p=>p.name.toLowerCase().includes(q)||String(p.group||'').toLowerCase().includes(q));
        document.getElementById('admin-products').innerHTML = '';
        out.forEach(p=>{
          const d = document.createElement('div'); d.className='admin-row'; const price = (Array.isArray(p.variants) && p.variants.length)? p.variants[0].price : Number(p.price||0);
          const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
          const nameSafe = esc(p.name||''); const groupSafe = esc(p.group||'');
          d.innerHTML = `<div><strong>${nameSafe}</strong><div style="font-size:12px;color:#666">${groupSafe} • R$ ${Number(price).toFixed(2)}</div></div><div class="row-actions"><button class="btn-edit" data-id="${p.id}">Editar</button><button class="btn-delete" data-id="${p.id}">Remover</button></div>`;
          document.getElementById('admin-products').appendChild(d);
        });
      });
    }

    // after product added/updated, clear editId
    document.addEventListener('products-updated',()=>{ const form = document.getElementById('product-form'); if(form){ delete form.dataset.editId } });
  });
})();
