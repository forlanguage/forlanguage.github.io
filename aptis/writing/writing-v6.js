(() => {
  "use strict";
  let bank = null;
  let test = null;
  let timer = null;
  let remaining = 3000;
  let startedAt = null;
  let autosaveTimer = null;
  const $ = (id) => document.getElementById(id);
  const draftKey = () => `aptisWritingDraft:${test?.test_id || "none"}:${$("modeSelect").value}`;
  const wordCount = (text) => (text.trim().match(/\b[\p{L}\p{N}'-]+\b/gu) || []).length;

  function selectedTasks() {
    const mode = $("modeSelect").value;
    return mode === "full" ? test.tasks : test.tasks.filter((task) => `part${task.part}` === mode);
  }

  function controlHtml(task) {
    if (task.questions) {
      return task.questions.map((question, index) => `
        <div class="answer-block">
          <label>${question}<span class="word-count" data-count="${task.task_id}-${index}">0 words</span></label>
          ${task.part === 1 ? `<input data-answer="${task.task_id}-${index}" maxlength="100">` : `<textarea data-answer="${task.task_id}-${index}"></textarea>`}
        </div>`).join("");
    }
    return `<div class="answer-block"><label>Your response <span class="word-count" data-count="${task.task_id}-0">0 words · target ${task.min_words}-${task.max_words}</span></label><textarea data-answer="${task.task_id}-0"></textarea></div>`;
  }

  function render() {
    const tasks = selectedTasks();
    $("writingHost").innerHTML = `
      <div class="writing-context"><strong>${test.test_id} · ${test.title}</strong><span>Common topic: ${test.topic}</span><span id="draftStatus">Draft chưa được lưu</span></div>
      ${tasks.map((task) => `<article class="writing-task"><p class="eyebrow">PART ${task.part}</p><h2>${task.type.replaceAll("_", " ")}</h2><p class="prompt">${task.prompt}</p>${controlHtml(task)}</article>`).join("")}`;
    restoreDraft();
    document.querySelectorAll("[data-answer]").forEach((element) => {
      element.addEventListener("input", () => {
        updateCount(element);
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => saveDraft(false), 700);
      });
    });
    ["saveDraft", "submitWriting", "exportJson", "printPdf"].forEach((id) => { $(id).disabled = false; });
  }

  function updateCount(element) {
    const id = element.dataset.answer;
    const counter = document.querySelector(`[data-count="${id}"]`);
    if (!counter) return;
    const task = test.tasks.find((row) => id.startsWith(row.task_id));
    const count = wordCount(element.value);
    counter.textContent = `${count} words${task?.min_words ? ` · target ${task.min_words}-${task.max_words}` : ""}`;
    counter.classList.toggle("warning", Boolean(task?.min_words && (count < task.min_words || count > task.max_words)));
  }

  function collect() {
    return selectedTasks().map((task) => ({
      task_id: task.task_id,
      part: task.part,
      type: task.type,
      prompt: task.prompt,
      responses: [...document.querySelectorAll(`[data-answer^="${task.task_id}-"]`)].map((element) => ({
        text: element.value,
        word_count: wordCount(element.value)
      }))
    }));
  }

  function saveDraft(showMessage = true) {
    if (!test) return;
    const savedAt = new Date().toISOString();
    localStorage.setItem(draftKey(), JSON.stringify({ saved_at: savedAt, responses: collect() }));
    const status = $("draftStatus");
    if (status) status.textContent = `Đã lưu draft lúc ${new Date(savedAt).toLocaleTimeString("vi-VN")}`;
    if (showMessage) alert("Đã lưu draft trên thiết bị.");
  }

  function restoreDraft() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(draftKey()) || "null"); } catch { data = null; }
    if (!data) return;
    data.responses?.forEach((task) => task.responses?.forEach((response, index) => {
      const element = document.querySelector(`[data-answer="${task.task_id}-${index}"]`);
      if (element) { element.value = response.text || ""; updateCount(element); }
    }));
    const status = $("draftStatus");
    if (status) status.textContent = `Khôi phục draft ${new Date(data.saved_at).toLocaleString("vi-VN")}`;
  }

  function buildPayload() {
    return {
      schema_version: "1.1",
      module: "writing",
      test_id: test.test_id,
      title: test.title,
      topic: test.topic,
      mode: $("modeSelect").value,
      started_at: startedAt,
      exported_at: new Date().toISOString(),
      responses: collect()
    };
  }

  function exportJson() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" }));
    link.download = `aptis-writing-${test.test_id}-${$("modeSelect").value}.json`;
    link.click();
  }

  async function submit() {
    const payload = buildPayload();
    const attemptId = `WRT-${test.test_id}-${Date.now()}`;
    await AptisAttemptStore.saveAttempt({
      attempt_id: attemptId,
      result_id: attemptId,
      module: "writing",
      test_id: test.test_id,
      mode: payload.mode,
      mode_label: test.title,
      started_at: startedAt,
      submitted_at: new Date().toISOString(),
      topic: test.topic,
      answers: payload.responses,
      total: payload.responses.length,
      completed: payload.responses.filter((task) => task.responses.some((response) => response.text.trim())).length,
      score: null,
      source: "forlanguage-writing-v1.1"
    });
    saveDraft(false);
    alert("Đã lưu bài Writing vào lịch sử trên thiết bị.");
  }

  function startTimer() {
    clearInterval(timer);
    startedAt ||= new Date().toISOString();
    timer = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      $("timer").textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
      if (!remaining) clearInterval(timer);
    }, 1000);
  }

  async function loadBank() {
    const response = await fetch("/aptis/data/writing/bank-v1.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bank = await response.json();
    $("testSelect").innerHTML = bank.tests.map((row) => `<option value="${row.test_id}">${row.test_id} · ${row.title}</option>`).join("");
  }

  $("loadTest").addEventListener("click", async () => {
    if (!bank) await loadBank();
    test = bank.tests.find((row) => row.test_id === $("testSelect").value);
    remaining = test.duration_seconds;
    startedAt = new Date().toISOString();
    $("timer").textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:00`;
    render();
  });
  $("modeSelect").addEventListener("change", () => { if (test) render(); });
  $("saveDraft").addEventListener("click", () => saveDraft(true));
  $("exportJson").addEventListener("click", exportJson);
  $("printPdf").addEventListener("click", () => window.print());
  $("submitWriting").addEventListener("click", () => submit().catch((error) => alert(error.message)));
  $("startTimer").addEventListener("click", startTimer);

  loadBank().catch((error) => console.error("Unable to load Writing bank", error));
})();
