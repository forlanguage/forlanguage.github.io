(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const selected = new Set();
  let attempts = [];

  const dateValue = (row) => Date.parse(row.submitted_at || row.updated_at || row.started_at || 0) || 0;
  const label = (module) => ({core:"Core",reading:"Reading",listening:"Listening",speaking:"Speaking",writing:"Writing"}[module] || module || "Khác");
  const download = (data, name) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"}));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  function controls() {
    return {
      status: $("#statusFilter"),
      favourite: $("#favouriteFilter"),
      sort: $("#sortOrder"),
      exportSelected: $("#exportSelected"),
      deleteSelected: $("#deleteSelected"),
      selectAll: $("#selectAllVisible"),
      selectedCount: $("#selectedCount"),
      health: $("#reviewHealth")
    };
  }

  function currentFilteredAttempts() {
    const module = $("#moduleFilter")?.value || "all";
    const text = ($("#historySearch")?.value || "").trim().toLowerCase();
    const status = controls().status?.value || "all";
    const favourite = controls().favourite?.value || "all";
    const result = attempts.filter((row) => {
      if (module !== "all" && row.module !== module) return false;
      if (status !== "all" && row.status !== status) return false;
      if (favourite === "yes" && row.favourite !== true) return false;
      if (favourite === "no" && row.favourite === true) return false;
      return !text || JSON.stringify(row).toLowerCase().includes(text);
    });
    const order = controls().sort?.value || "newest";
    return result.sort((a,b) => {
      if (order === "oldest") return dateValue(a) - dateValue(b);
      if (order === "module") return String(a.module).localeCompare(String(b.module)) || dateValue(b)-dateValue(a);
      if (order === "test") return String(a.test_id || a.mode_label).localeCompare(String(b.test_id || b.mode_label));
      if (order === "completion") return Number(b.completed || 0)/Math.max(Number(b.total || 1),1) - Number(a.completed || 0)/Math.max(Number(a.total || 1),1);
      return dateValue(b) - dateValue(a);
    });
  }

  function enhanceTable() {
    const table = $(".history-table-wrap table");
    if (!table) return;
    const head = table.querySelector("thead tr");
    if (head && !head.querySelector(".select-column")) {
      const th = document.createElement("th");
      th.className = "select-column";
      th.textContent = "Chọn";
      head.prepend(th);
    }
    const attemptById = new Map(attempts.map(row => [row.attempt_id, row]));
    $$("#historyRows tr").forEach((tr) => {
      const button = tr.querySelector("[data-review]");
      if (!button) return;
      const id = button.dataset.review;
      const row = attemptById.get(id);
      tr.dataset.attemptId = id;
      tr.dataset.module = row?.module || "unknown";
      tr.dataset.status = row?.status || "completed";
      tr.dataset.favourite = row?.favourite === true ? "yes" : "no";
      if (!tr.querySelector("[data-select-attempt]")) {
        const td = document.createElement("td");
        td.className = "select-column";
        td.innerHTML = `<input type="checkbox" data-select-attempt="${id}" aria-label="Chọn attempt ${id}">`;
        tr.prepend(td);
        td.querySelector("input").addEventListener("change", (event) => {
          event.target.checked ? selected.add(id) : selected.delete(id);
          updateSelection();
        });
      }
      const checkbox = tr.querySelector("[data-select-attempt]");
      checkbox.checked = selected.has(id);
    });
    applyFilters();
  }

  function applyFilters() {
    const visible = currentFilteredAttempts();
    const position = new Map(visible.map((row,index) => [row.attempt_id,index]));
    $$("#historyRows tr[data-attempt-id]").forEach((tr) => {
      const order = position.get(tr.dataset.attemptId);
      tr.hidden = order === undefined;
      if (order !== undefined) tr.style.order = String(order);
    });
    const body = $("#historyRows");
    if (body) body.style.display = "table-row-group";
    updateSummaryCards(visible);
    updateSelection();
  }

  function updateSummaryCards(visible) {
    const host = $("#reviewSummaryCards");
    if (!host) return;
    const completed = visible.filter(row => row.status === "completed").length;
    const active = visible.filter(row => row.status === "in_progress").length;
    const favourites = visible.filter(row => row.favourite === true).length;
    const modules = [...new Set(visible.map(row => row.module))].length;
    host.innerHTML = [
      [visible.length,"Đang hiển thị"],
      [completed,"Đã hoàn thành"],
      [active,"Đang làm"],
      [favourites,"Yêu thích"],
      [modules,"Module"]
    ].map(([value,title]) => `<article><strong>${value}</strong><span>${title}</span></article>`).join("");
  }

  function updateSelection() {
    const c = controls();
    const visibleIds = new Set(currentFilteredAttempts().map(row => row.attempt_id));
    const visibleSelected = [...selected].filter(id => visibleIds.has(id)).length;
    if (c.selectedCount) c.selectedCount.textContent = `${selected.size} attempt đã chọn`;
    if (c.exportSelected) c.exportSelected.disabled = selected.size === 0;
    if (c.deleteSelected) c.deleteSelected.disabled = selected.size === 0;
    if (c.selectAll) c.selectAll.checked = visibleIds.size > 0 && visibleSelected === visibleIds.size;
  }

  async function runHealthCheck() {
    const c = controls();
    if (!c.health) return;
    c.health.textContent = "Đang kiểm tra dữ liệu cục bộ…";
    const summary = await AptisAttemptStore.getStorageSummary();
    let linkedAssets = 0;
    for (const row of attempts) linkedAssets += (await AptisAttemptStore.listAssets(row.attempt_id)).length;
    const incomplete = attempts.filter(row => row.status === "in_progress").length;
    const missingIds = attempts.filter(row => !row.attempt_id || !row.module).length;
    c.health.innerHTML = `<strong>Local data health: ${missingIds ? "Cần kiểm tra" : "Tốt"}</strong><span>${attempts.length} attempts · ${summary.drafts} drafts · ${linkedAssets} linked recordings · ${incomplete} phiên đang làm</span><small>Kiểm tra không tự động sửa hoặc xóa dữ liệu.</small>`;
  }

  function bindControls() {
    const c = controls();
    [$("#moduleFilter"),$("#historySearch"),c.status,c.favourite,c.sort].filter(Boolean).forEach((node) => {
      node.addEventListener(node.tagName === "INPUT" ? "input" : "change", () => setTimeout(enhanceTable, 0));
    });
    c.selectAll?.addEventListener("change", () => {
      const ids = currentFilteredAttempts().map(row => row.attempt_id);
      ids.forEach(id => c.selectAll.checked ? selected.add(id) : selected.delete(id));
      enhanceTable();
    });
    c.exportSelected?.addEventListener("click", () => {
      const rows = attempts.filter(row => selected.has(row.attempt_id));
      download({schema_version:"2.0.0",export_type:"aptis_selected_attempts",exported_at:new Date().toISOString(),count:rows.length,attempts:rows}, `aptis-selected-attempts-${new Date().toISOString().slice(0,10)}.json`);
    });
    c.deleteSelected?.addEventListener("click", async () => {
      if (!selected.size || !confirm(`Xóa ${selected.size} attempts và toàn bộ assets liên quan?`)) return;
      for (const id of [...selected]) await AptisAttemptStore.deleteAttempt(id);
      selected.clear();
      location.reload();
    });
    $("#runHealthCheck")?.addEventListener("click", () => runHealthCheck().catch(error => { if(c.health)c.health.textContent=error.message; }));
  }

  async function init() {
    attempts = await AptisAttemptStore.listAttempts();
    bindControls();
    const observer = new MutationObserver(() => enhanceTable());
    const rows = $("#historyRows");
    if (rows) observer.observe(rows, {childList:true});
    setTimeout(enhanceTable, 50);
    await runHealthCheck();
  }

  window.addEventListener("aptis-attempt-updated", async () => {
    attempts = await AptisAttemptStore.listAttempts();
    enhanceTable();
  });
  init().catch(console.error);
})();
