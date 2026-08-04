(() => {
  "use strict";

  const DB_NAME = "forlanguage-aptis-v6";
  const DB_VERSION = 2;
  const CONTRACT_VERSION = "2.0.0";
  const STORE_ATTEMPTS = "attempts";
  const STORE_ASSETS = "assets";
  const STORE_DRAFTS = "drafts";
  const LEGACY_HISTORY_KEY = "aptisTestHistoryV1";

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
          const attempts = db.createObjectStore(STORE_ATTEMPTS, { keyPath: "attempt_id" });
          attempts.createIndex("module", "module", { unique: false });
          attempts.createIndex("submitted_at", "submitted_at", { unique: false });
          attempts.createIndex("session_id", "session_id", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          const assets = db.createObjectStore(STORE_ASSETS, { keyPath: "asset_id" });
          assets.createIndex("attempt_id", "attempt_id", { unique: false });
          assets.createIndex("kind", "kind", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          const drafts = db.createObjectStore(STORE_DRAFTS, { keyPath: "draft_id" });
          drafts.createIndex("module", "module", { unique: false });
          drafts.createIndex("updated_at", "updated_at", { unique: false });
          drafts.createIndex("test_id", "test_id", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open Aptis database"));
    });
  }

  async function withStore(storeName, mode, callback) {
    const db = await openDb();
    try {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const value = await callback(store);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
        transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
      });
      return value;
    } finally {
      db.close();
    }
  }

  function moduleFromLegacy(record) {
    if (record.module) return record.module;
    if (String(record.mode || "").startsWith("reading")) return "reading";
    if (["core50", "mini10", "grammar25", "vocab25"].includes(record.mode)) return "core";
    return "unknown";
  }

  function normalizeScore(score, record = {}) {
    if (score && typeof score === "object") {
      const total = Number(score.total || 0);
      const correct = Number(score.correct || 0);
      return { correct, total, percent: Number.isFinite(Number(score.percent)) ? Number(score.percent) : (total ? Math.round(correct * 100 / total) : null), blank: Number(score.blank || 0) };
    }
    if (Number.isFinite(Number(score))) return { correct: Number(score), total: Number(record.total || 0), percent: null, blank: 0 };
    return null;
  }

  function normalizeAttempt(record) {
    const attemptId = record.attempt_id || record.result_id || `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const responses = Array.isArray(record.responses) ? record.responses : (Array.isArray(record.answers) ? record.answers : []);
    const submittedAt = record.submitted_at || record.completed_at || null;
    return {
      ...record,
      attempt_id: attemptId,
      result_id: record.result_id || attemptId,
      schema_version: CONTRACT_VERSION,
      storage_version: "6.1",
      module: moduleFromLegacy(record),
      test_id: record.test_id || record.reading_test_id || null,
      mode: record.mode || "practice",
      mode_label: record.mode_label || record.title || record.mode || "Bài luyện",
      status: record.status || (submittedAt ? "completed" : "in_progress"),
      started_at: record.started_at || null,
      submitted_at: submittedAt,
      updated_at: record.updated_at || submittedAt || new Date().toISOString(),
      duration_seconds: Number(record.duration_seconds || 0),
      score: normalizeScore(record.score, record),
      responses,
      answers: responses,
      asset_refs: Array.isArray(record.asset_refs) ? record.asset_refs : [],
      notes: record.notes || "",
      storage: {
        local: true,
        drive: Boolean(record.synced_to_drive || record.storage?.drive)
      },
      synced_to_drive: Boolean(record.synced_to_drive || record.storage?.drive),
      migrated_from_legacy: Boolean(record.migrated_from_legacy)
    };
  }

  async function saveAttempt(record) {
    const normalized = normalizeAttempt(record);
    await withStore(STORE_ATTEMPTS, "readwrite", (store) => requestToPromise(store.put(normalized)));
    return normalized;
  }
  async function getAttempt(attemptId) { return withStore(STORE_ATTEMPTS, "readonly", (store) => requestToPromise(store.get(attemptId))); }
  async function listAttempts() {
    const rows = await withStore(STORE_ATTEMPTS, "readonly", (store) => requestToPromise(store.getAll()));
    return rows.map(normalizeAttempt).sort((a, b) => String(b.submitted_at || b.updated_at || "").localeCompare(String(a.submitted_at || a.updated_at || "")));
  }

  async function saveAsset(asset) {
    if (!asset?.asset_id || !asset?.attempt_id) throw new Error("asset_id and attempt_id are required");
    const normalized = { ...asset, schema_version: CONTRACT_VERSION, created_at: asset.created_at || new Date().toISOString() };
    await withStore(STORE_ASSETS, "readwrite", (store) => requestToPromise(store.put(normalized)));
    return normalized;
  }
  async function getAsset(assetId) { return withStore(STORE_ASSETS, "readonly", (store) => requestToPromise(store.get(assetId))); }
  async function listAssets(attemptId) { return withStore(STORE_ASSETS, "readonly", (store) => requestToPromise(store.index("attempt_id").getAll(attemptId))); }
  async function deleteAsset(assetId) { await withStore(STORE_ASSETS, "readwrite", (store) => requestToPromise(store.delete(assetId))); }
  async function deleteAssetsForAttempt(attemptId) { const assets = await listAssets(attemptId); for (const asset of assets) await deleteAsset(asset.asset_id); return assets.length; }
  async function deleteAttempt(attemptId, options = { deleteAssets: true }) { if (options.deleteAssets !== false) await deleteAssetsForAttempt(attemptId); await withStore(STORE_ATTEMPTS, "readwrite", (store) => requestToPromise(store.delete(attemptId))); }

  function normalizeDraft(draft) {
    if (!draft?.draft_id || !draft?.module || !draft?.test_id) throw new Error("draft_id, module and test_id are required");
    return { ...draft, schema_version: CONTRACT_VERSION, status: draft.status || "in_progress", updated_at: new Date().toISOString() };
  }
  async function saveDraft(draft) { const row = normalizeDraft(draft); await withStore(STORE_DRAFTS, "readwrite", (store) => requestToPromise(store.put(row))); return row; }
  async function getDraft(draftId) { return withStore(STORE_DRAFTS, "readonly", (store) => requestToPromise(store.get(draftId))); }
  async function listDrafts() { const rows = await withStore(STORE_DRAFTS, "readonly", (store) => requestToPromise(store.getAll())); return rows.sort((a,b)=>String(b.updated_at||"").localeCompare(String(a.updated_at||""))); }
  async function deleteDraft(draftId) { await withStore(STORE_DRAFTS, "readwrite", (store) => requestToPromise(store.delete(draftId))); }

  async function getStorageSummary() {
    const attempts = await listAttempts();
    const assets = await withStore(STORE_ASSETS, "readonly", (store) => requestToPromise(store.getAll()));
    const drafts = await listDrafts();
    const assetBytes = assets.reduce((sum, asset) => sum + Number(asset.blob?.size || asset.size || 0), 0);
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : {};
    return { attempts: attempts.length, assets: assets.length, drafts: drafts.length, asset_bytes: assetBytes, usage: estimate.usage || null, quota: estimate.quota || null };
  }

  async function exportBackup() { return { schema_version: CONTRACT_VERSION, export_type: "aptis_local_backup", exported_at: new Date().toISOString(), attempts: await listAttempts(), drafts: await listDrafts() }; }
  async function importBackup(payload) {
    if (!payload || !Array.isArray(payload.attempts)) throw new Error("Invalid Aptis backup");
    let attempts = 0, drafts = 0;
    for (const row of payload.attempts) { await saveAttempt(row); attempts += 1; }
    for (const row of payload.drafts || []) { await saveDraft(row); drafts += 1; }
    return { attempts, drafts };
  }

  async function migrateLegacyHistory() {
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || "[]"); } catch { legacy = []; }
    if (!Array.isArray(legacy) || !legacy.length) return { migrated: 0 };
    const existing = new Set((await listAttempts()).map((row) => row.result_id || row.attempt_id));
    let migrated = 0;
    for (const row of legacy) {
      const id = row.result_id || row.attempt_id;
      if (id && existing.has(id)) continue;
      await saveAttempt({ ...row, migrated_from_legacy: true }); migrated += 1;
    }
    return { migrated };
  }

  window.AptisAttemptStore = Object.freeze({
    dbName: DB_NAME, dbVersion: DB_VERSION, contractVersion: CONTRACT_VERSION,
    saveAttempt, getAttempt, listAttempts, deleteAttempt, normalizeAttempt,
    saveAsset, getAsset, listAssets, deleteAsset, deleteAssetsForAttempt,
    saveDraft, getDraft, listDrafts, deleteDraft,
    getStorageSummary, exportBackup, importBackup, migrateLegacyHistory
  });
})();
