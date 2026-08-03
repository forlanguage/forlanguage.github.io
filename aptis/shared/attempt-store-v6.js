(() => {
  "use strict";

  const DB_NAME = "forlanguage-aptis-v6";
  const DB_VERSION = 1;
  const STORE_ATTEMPTS = "attempts";
  const STORE_ASSETS = "assets";
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

  function normalizeAttempt(record) {
    const attemptId = record.attempt_id || record.result_id || `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      ...record,
      attempt_id: attemptId,
      result_id: record.result_id || attemptId,
      module: moduleFromLegacy(record),
      schema_version: record.schema_version || "1.1",
      storage_version: "6.0",
      synced_to_drive: Boolean(record.synced_to_drive),
      migrated_from_legacy: Boolean(record.migrated_from_legacy)
    };
  }

  async function saveAttempt(record) {
    const normalized = normalizeAttempt(record);
    await withStore(STORE_ATTEMPTS, "readwrite", (store) => requestToPromise(store.put(normalized)));
    return normalized;
  }

  async function getAttempt(attemptId) {
    return withStore(STORE_ATTEMPTS, "readonly", (store) => requestToPromise(store.get(attemptId)));
  }

  async function listAttempts() {
    const rows = await withStore(STORE_ATTEMPTS, "readonly", (store) => requestToPromise(store.getAll()));
    return rows.sort((a, b) => String(b.submitted_at || "").localeCompare(String(a.submitted_at || "")));
  }

  async function deleteAttempt(attemptId) {
    await withStore(STORE_ATTEMPTS, "readwrite", (store) => requestToPromise(store.delete(attemptId)));
  }

  async function saveAsset(asset) {
    if (!asset?.asset_id || !asset?.attempt_id) throw new Error("asset_id and attempt_id are required");
    await withStore(STORE_ASSETS, "readwrite", (store) => requestToPromise(store.put(asset)));
    return asset;
  }

  async function listAssets(attemptId) {
    return withStore(STORE_ASSETS, "readonly", (store) =>
      requestToPromise(store.index("attempt_id").getAll(attemptId))
    );
  }

  async function migrateLegacyHistory() {
    let legacy = [];
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || "[]");
    } catch {
      legacy = [];
    }
    if (!Array.isArray(legacy) || !legacy.length) return { migrated: 0 };

    const existing = new Set((await listAttempts()).map((row) => row.result_id || row.attempt_id));
    let migrated = 0;
    for (const row of legacy) {
      const id = row.result_id || row.attempt_id;
      if (id && existing.has(id)) continue;
      await saveAttempt({ ...row, migrated_from_legacy: true });
      migrated += 1;
    }
    return { migrated };
  }

  window.AptisAttemptStore = Object.freeze({
    dbName: DB_NAME,
    saveAttempt,
    getAttempt,
    listAttempts,
    deleteAttempt,
    saveAsset,
    listAssets,
    migrateLegacyHistory,
    normalizeAttempt
  });
})();
