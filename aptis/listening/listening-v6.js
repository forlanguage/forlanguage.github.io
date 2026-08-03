(() => {
  "use strict";

  const host = document.querySelector("#listeningStatus");
  fetch("/aptis/data/listening/manifest.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((manifest) => {
      host.innerHTML = `
        <strong>${manifest.status === "SCHEMA_READY" ? "Schema ready" : manifest.status}</strong>
        <span>${manifest.test_count} tests · ${manifest.task_count} tasks · ${manifest.audio_count} audio · ${manifest.item_count} items</span>
        <span>Version ${manifest.version}</span>
      `;
    })
    .catch((error) => {
      console.error(error);
      host.innerHTML = `<strong>Manifest unavailable</strong><span>${error.message || error}</span>`;
    });
})();
