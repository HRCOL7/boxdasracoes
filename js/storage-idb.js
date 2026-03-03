/* Lightweight IndexedDB wrapper for products
   - Provides init(), getAll(), get(id), put(product), bulkPut(products), delete(id), clear(), count(), migrateFromLocalStorage()
   - Emits events on `document` during migration: 'idb-migration-progress' (detail: {done, total}) and 'idb-migration-complete'
*/
(function(){
  const DB_NAME = 'boxd_products_db';
  const STORE = 'products';
  const VERSION = 1;
  let dbPromise = null;

  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      try{
        const req = indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = function(e){
          const db = e.target.result;
          if(!db.objectStoreNames.contains(STORE)){
            const os = db.createObjectStore(STORE, { keyPath: 'id' });
            os.createIndex('name', 'name', { unique: false });
            os.createIndex('group', 'group', { unique: false });
          }
        };
        req.onsuccess = function(e){ resolve(e.target.result); };
        req.onerror = function(e){ reject(e.target.error || new Error('IDB open error')); };
      }catch(err){ reject(err); }
    });
    return dbPromise;
  }

  function withStore(mode, callback){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let done = false;
      tx.oncomplete = () => { done = true; resolve(); };
      tx.onerror = (e) => { if(!done) reject(e.target.error || new Error('Transaction error')); };
      try{ callback(store); }catch(err){ reject(err); }
    }));
  }

  function getAll(){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('getAll failed'));
    }));
  }

  function get(id){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
      req.onerror = () => reject(req.error || new Error('get failed'));
    }));
  }

  function put(item){
    return withStore('readwrite', store => { store.put(item); });
  }

  function bulkPut(items){
    if(!Array.isArray(items)) return Promise.reject(new Error('bulkPut expects array'));
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let i = 0;
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error || new Error('bulkPut transaction error'));
      try{
        for(; i<items.length; i++){
          store.put(items[i]);
        }
      }catch(err){ reject(err); }
    }));
  }

  function del(id){
    return withStore('readwrite', store => { store.delete(id); });
  }

  function clear(){
    return withStore('readwrite', store => { store.clear(); });
  }

  function count(){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.count();
      req.onsuccess = () => resolve(Number(req.result || 0));
      req.onerror = () => reject(req.error || new Error('count failed'));
    }));
  }

  // Get a page of items using a cursor (efficient for large stores)
  function getPage(offset = 0, limit = 50){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const results = [];
      let advanced = false;
      const req = store.openCursor();
      req.onsuccess = function(e){
        const cursor = e.target.result;
        if(!cursor){ resolve(results); return; }
        if(!advanced && offset > 0){
          advanced = true;
          try{ cursor.advance(offset); }catch(err){ reject(err); }
          return;
        }
        results.push(cursor.value);
        if(results.length >= limit){ resolve(results); return; }
        cursor.continue();
      };
      req.onerror = function(e){ reject(e.target.error || new Error('getPage failed')); };
    }));
  }

  // Search for term (case-insensitive) in name and group fields, return paged results and total match count
  function search(term, offset = 0, limit = 50){
    term = String(term||'').trim().toLowerCase();
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const results = [];
      let total = 0;
      const req = store.openCursor();
      req.onsuccess = function(e){
        const cursor = e.target.result;
        if(!cursor){ resolve({ results, total }); return; }
        try{
          const val = cursor.value || {};
          const name = String(val.name||'').toLowerCase();
          const group = String(val.group||'').toLowerCase();
          const match = !term || name.indexOf(term) !== -1 || group.indexOf(term) !== -1;
          if(match){
            if(total >= offset && results.length < limit){ results.push(val); }
            total++;
          }
        }catch(err){ /* ignore per-row errors */ }
        cursor.continue();
      };
      req.onerror = function(e){ reject(e.target.error || new Error('search failed')); };
    }));
  }

  // Migrate from localStorage 'products' array into IndexedDB in batches.
  function migrateFromLocalStorage(batchSize = 200){
    return new Promise(async (resolve, reject) => {
      try{
        const raw = localStorage.getItem('products');
        if(!raw){ resolve({ migrated: 0 }); return; }
        let arr = [];
        try{ arr = JSON.parse(raw) || []; }catch(e){ resolve({ migrated: 0 }); return; }
        const total = arr.length;
        if(total === 0){ resolve({ migrated: 0 }); return; }
        await openDB();
        let migrated = 0;
        for(let i=0;i<total;i+=batchSize){
          const slice = arr.slice(i, i+batchSize);
          await bulkPut(slice);
          migrated += slice.length;
          try{ document.dispatchEvent(new CustomEvent('idb-migration-progress',{detail:{done:migrated,total}})); }catch(e){}
        }
        try{ document.dispatchEvent(new CustomEvent('idb-migration-complete',{detail:{migrated,total}})); }catch(e){}
        resolve({ migrated, total });
      }catch(err){ reject(err); }
    });
  }

  window.idbProducts = {
    init: openDB,
    getAll,
    get,
    getPage,
    search,
    put,
    bulkPut,
    delete: del,
    clear,
    count,
    migrateFromLocalStorage
  };

})();
