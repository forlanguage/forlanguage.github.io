(() => {
  "use strict";
  const DB_NAME = "forlanguage-aptis-draft-versions-v1";
  const DB_VERSION = 1;
  const STORE = "versions";
  const req = (r) => new Promise((resolve, reject) => { r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error||new Error("IndexedDB request failed")); });
  function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:"version_id"});s.createIndex("draft_id","draft_id",{unique:false});s.createIndex("created_at","created_at",{unique:false});}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error("Unable to open draft versions"));});}
  async function withStore(mode,fn){const db=await open();try{const tx=db.transaction(STORE,mode);const value=await fn(tx.objectStore(STORE));await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return value;}finally{db.close();}}
  async function saveVersion(draft, reason="autosave"){if(!draft?.draft_id)throw new Error("draft_id is required");const row={...structuredClone(draft),version_id:`${draft.draft_id}:${Date.now()}:${Math.random().toString(36).slice(2,6)}`,draft_id:draft.draft_id,created_at:new Date().toISOString(),reason};await withStore("readwrite",s=>req(s.put(row)));return row;}
  async function listVersions(draftId){const rows=await withStore("readonly",s=>req(s.index("draft_id").getAll(draftId)));return rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));}
  async function getVersion(versionId){return withStore("readonly",s=>req(s.get(versionId)));}
  async function deleteVersion(versionId){return withStore("readwrite",s=>req(s.delete(versionId)));}
  async function trim(draftId,keep=20){const rows=await listVersions(draftId);for(const row of rows.slice(keep))await deleteVersion(row.version_id);return Math.min(rows.length,keep);}
  window.AptisDraftVersions=Object.freeze({dbName:DB_NAME,saveVersion,listVersions,getVersion,deleteVersion,trim});
})();
