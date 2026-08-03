(() => {
  "use strict";

  const q = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
  const fmt = (iso) => {
    try {
      return iso ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "—";
    } catch {
      return iso || "—";
    }
  };
  const moduleName = (value) => ({
    core: "Grammar & Vocabulary",
    reading: "Reading",
    listening: "Listening",
    speaking: "Speaking",
    writing: "Writing",
    unknown: "Khác"
  })[value] || value || "Khác";

  let rows = [];

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filteredRows() {
    const module = q("#moduleFilter").value;
    const term = q("#historySearch").value.trim().toLowerCase();
    return rows.filter((row) => {
      if (module !== "all" && row.module !== module) return false;
      if (!term) return true;
      return JSON.stringify({
        attempt_id: row.attempt_id,
        result_id: row.result_id,
        module: row.module,
        mode: row.mode,
        mode_label: row.mode_label,
        reading_test_id: row.reading_test_id,
        answers: (row.answers || []).map((answer) => answer.item_id)
      }).toLowerCase().includes(term);
    });
  }

  function render() {
    const visible = filteredRows();
    const totalQuestions = rows.reduce((sum, row) => sum + Number(row.score?.total || 0), 0);
    q("#historySummary").innerHTML = `<strong>${rows.length} lượt làm</strong><br><span>${totalQuestions.toLocaleString("vi-VN")} câu đã lưu</span>`;

    q("#historyRows").innerHTML = visible.length ? visible.map((row) => {
      const score = row.score?.total ? `${row.score.correct}/${row.score.total} (${row.score.percent}%)` : "Hoàn thành";
      return `<tr>
        <td>${esc(fmt(row.submitted_at))}</td>
        <td><span class="badge">${esc(moduleName(row.module))}</span></td>
        <td><strong>${esc(row.mode_label || row.mode || row.test_id || "Bài luyện")}</strong><br><small>${esc(row.reading_test_id || row.test_id || row.attempt_id)}</small></td>
        <td>${esc(score)}</td>
        <td>${row.migrated_from_legacy ? "Migrated from v5" : "IndexedDB v6"}${row.synced_to_drive ? " · Drive" : ""}</td>
        <td><div class="row-actions">
          <button data-json="${esc(row.attempt_id)}">JSON</button>
          <button data-delete="${esc(row.attempt_id)}">Xóa</button>
        </div></td>
      </tr>`;
    }).join("") : `<tr><td class="empty" colspan="6">Không có kết quả phù hợp.</td></tr>`;

    document.querySelectorAll("[data-json]").forEach((button) => {
      button.onclick = () => {
        const row = rows.find((item) => item.attempt_id === button.dataset.json);
        if (row) downloadJson(row, `aptis-${row.module}-${row.attempt_id}.json`);
      };
    });
    document.querySelectorAll("[data-delete]").forEach((button) => {
      button.onclick = async () => {
        const id = button.dataset.delete;
        if (!confirm("Xóa kết quả này khỏi IndexedDB? Lịch sử v5 trong localStorage sẽ không bị thay đổi.")) return;
        await window.AptisAttemptStore.deleteAttempt(id);
        await load();
      };
    });
  }

  async function load() {
    await window.AptisAttemptStore.migrateLegacyHistory();
    rows = await window.AptisAttemptStore.listAttempts();
    render();
  }

  q("#moduleFilter").addEventListener("change", render);
  q("#historySearch").addEventListener("input", render);
  q("#refreshHistory").onclick = load;
  q("#exportHistory").onclick = () => {
    const visible = filteredRows();
    downloadJson({
      schema_version: "6.0",
      export_type: "aptis_unified_history",
      exported_at: new Date().toISOString(),
      result_count: visible.length,
      results: visible
    }, `aptis-unified-history-${new Date().toISOString().slice(0, 10)}.json`);
  };
  document.addEventListener("aptis:history-synced", load);

  load().catch((error) => {
    console.error(error);
    q("#historyRows").innerHTML = `<tr><td class="empty" colspan="6">Không thể tải lịch sử: ${esc(error.message || error)}</td></tr>`;
  });
})();
