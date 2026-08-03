(() => {
  "use strict";

  const HISTORY_KEY = "aptisTestHistoryV1";
  const originalSetItem = Storage.prototype.setItem;
  let syncing = false;

  async function syncLegacyRows() {
    if (syncing || !window.AptisAttemptStore) return;
    syncing = true;
    try {
      await window.AptisAttemptStore.migrateLegacyHistory();
      document.dispatchEvent(new CustomEvent("aptis:history-synced"));
    } catch (error) {
      console.error("Aptis v6 history sync failed", error);
    } finally {
      syncing = false;
    }
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && key === HISTORY_KEY) {
      queueMicrotask(syncLegacyRows);
    }
  };

  window.addEventListener("storage", (event) => {
    if (event.storageArea === localStorage && event.key === HISTORY_KEY) syncLegacyRows();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncLegacyRows, { once: true });
  } else {
    syncLegacyRows();
  }

  window.AptisHistoryBridge = Object.freeze({ sync: syncLegacyRows });
})();
