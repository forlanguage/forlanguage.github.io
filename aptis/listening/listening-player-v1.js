(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const labels = "ABCDEFGHIJ";
  const state = {
    bank: null,
    test: null,
    taskIndex: 0,
    playCounts: {},
    answers: {},
    submitted: false,
    startedAt: null
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);

  async function loadJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  function updateStatus(manifest) {
    $("#listeningStatus").innerHTML = `
      <strong>${escapeHtml(manifest.status)}</strong>
      <span>${manifest.test_count} test · ${manifest.task_count} tasks · ${manifest.item_count} items</span>
      <span>Version ${escapeHtml(manifest.version)}</span>`;
  }

  function ensureSelector() {
    const host = $("#practiceHost");
    host.innerHTML = `
      <div class="practice-card test-picker">
        <label>Chọn bộ Listening
          <select id="listeningTestSelect">
            ${state.bank.tests.map((test) => `<option value="${test.test_id}">${test.test_id} · ${escapeHtml(test.title)}</option>`).join("")}
          </select>
        </label>
        <button id="startListeningBtn" type="button">Bắt đầu</button>
      </div>`;
    $("#startListeningBtn").addEventListener("click", () => {
      state.test = state.bank.tests.find((test) => test.test_id === $("#listeningTestSelect").value);
      state.taskIndex = 0;
      state.playCounts = {};
      state.answers = {};
      state.submitted = false;
      state.startedAt = new Date().toISOString();
      renderTask();
    });
  }

  function currentTask() {
    return state.test.tasks[state.taskIndex];
  }

  function renderTask() {
    speechSynthesis?.cancel?.();
    const task = currentTask();
    const playCount = state.playCounts[task.task_id] || 0;
    $("#practiceHost").innerHTML = `
      <article class="practice-card">
        <div class="practice-meta">
          <span>${state.test.test_id}</span><span>Part ${task.part}</span>
          <span>Task ${state.taskIndex + 1}/${state.test.tasks.length}</span><span>${state.test.level}</span>
        </div>
        <h2>${escapeHtml(task.instructions_vi)}</h2>
        <div class="audio-panel">
          <button id="playAudioBtn" type="button" ${playCount >= task.max_plays ? "disabled" : ""}>▶ Nghe audio</button>
          <span id="playCounter">Lượt nghe: ${playCount}/${task.max_plays}</span>
          <small>${task.audio.audio_url ? "Audio file" : "Bản demo dùng giọng đọc của trình duyệt."}</small>
          <audio id="audioElement" preload="metadata"></audio>
        </div>
        <div class="task-items">
          ${task.items.map((item) => `
            <section class="question-block">
              <small>Question ID: ${item.item_id}</small>
              <h3>${escapeHtml(item.question)}</h3>
              <div class="answer-list">
                ${item.options.map((option, index) => {
                  const label = labels[index];
                  const checked = state.answers[item.item_id] === label ? "checked" : "";
                  return `<label><input type="radio" name="${item.item_id}" value="${label}" ${checked}><b>${label}.</b> ${escapeHtml(option)}</label>`;
                }).join("")}
              </div>
            </section>`).join("")}
        </div>
        <div class="practice-actions">
          <button id="prevListeningBtn" type="button" ${state.taskIndex === 0 ? "disabled" : ""}>← Trước</button>
          <button id="nextListeningBtn" type="button">${state.taskIndex === state.test.tasks.length - 1 ? "Nộp bài" : "Tiếp →"}</button>
        </div>
      </article>`;

    $("#playAudioBtn").addEventListener("click", playAudio);
    task.items.forEach((item) => {
      document.querySelectorAll(`input[name="${item.item_id}"]`).forEach((input) => {
        input.addEventListener("change", () => { state.answers[item.item_id] = input.value; });
      });
    });
    $("#prevListeningBtn").addEventListener("click", () => { state.taskIndex -= 1; renderTask(); });
    $("#nextListeningBtn").addEventListener("click", () => {
      if (state.taskIndex < state.test.tasks.length - 1) {
        state.taskIndex += 1;
        renderTask();
      } else {
        submitTest();
      }
    });
  }

  function speakFallback(task) {
    if (!("speechSynthesis" in window)) {
      alert("Trình duyệt không hỗ trợ giọng đọc demo.");
      return false;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(task.audio.transcript);
    utterance.lang = "en-GB";
    utterance.rate = 0.92;
    speechSynthesis.speak(utterance);
    return true;
  }

  function playAudio() {
    const task = currentTask();
    const count = state.playCounts[task.task_id] || 0;
    if (count >= task.max_plays) return;
    const increment = () => {
      state.playCounts[task.task_id] = count + 1;
      $("#playCounter").textContent = `Lượt nghe: ${count + 1}/${task.max_plays}`;
      if (count + 1 >= task.max_plays) $("#playAudioBtn").disabled = true;
    };
    if (task.audio.audio_url) {
      const audio = $("#audioElement");
      audio.src = task.audio.audio_url;
      audio.currentTime = 0;
      audio.play().then(increment).catch(() => { if (speakFallback(task)) increment(); });
    } else if (speakFallback(task)) {
      increment();
    }
  }

  async function submitTest() {
    const items = state.test.tasks.flatMap((task) => task.items.map((item) => ({ ...item, part: task.part, task_id: task.task_id })));
    const answers = items.map((item) => {
      const selected = state.answers[item.item_id] || null;
      return {
        item_id: item.item_id,
        task_id: item.task_id,
        part: item.part,
        user_label: selected,
        correct_label: item.correct,
        is_correct: selected === item.correct,
        explanation_vi: item.explanation_vi,
        question: item.question,
        correct_value: item.correct_value
      };
    });
    const correct = answers.filter((answer) => answer.is_correct).length;
    const blank = answers.filter((answer) => !answer.user_label).length;
    const percent = Math.round((correct / answers.length) * 100);
    const attemptId = `ATT-L-${Date.now()}`;
    await window.AptisAttemptStore?.saveAttempt({
      attempt_id: attemptId,
      result_id: attemptId,
      module: "listening",
      mode: state.test.tasks.length > 1 ? "listening_full_demo" : "listening_quick_demo",
      mode_label: state.test.title,
      test_id: state.test.test_id,
      started_at: state.startedAt,
      submitted_at: new Date().toISOString(),
      score: { correct, total: answers.length, percent, blank },
      answers,
      play_counts: state.playCounts,
      source: "forlanguage-listening-v1.1"
    });
    renderReview(answers, correct, percent);
  }

  function renderReview(answers, correct, percent) {
    const taskMap = Object.fromEntries(state.test.tasks.map((task) => [task.task_id, task]));
    $("#practiceHost").innerHTML = `
      <article class="practice-card">
        <div class="result-overview"><strong>${correct}/${answers.length}</strong><span>${percent}%</span></div>
        <h2>Review ${escapeHtml(state.test.title)}</h2>
        ${answers.map((answer) => {
          const task = taskMap[answer.task_id];
          return `<section class="listening-result ${answer.is_correct ? "correct" : "wrong"}">
            <small>${answer.item_id} · Part ${answer.part}</small>
            <h3>${escapeHtml(answer.question)}</h3>
            <p>Bạn chọn: ${escapeHtml(answer.user_label || "Chưa trả lời")} · Đáp án: ${answer.correct_label} — ${escapeHtml(answer.correct_value)}</p>
            <p>${escapeHtml(answer.explanation_vi)}</p>
            <details><summary>Transcript</summary><p>${escapeHtml(task.audio.transcript)}</p></details>
          </section>`;
        }).join("")}
        <div class="practice-actions"><button id="retryTestBtn" type="button">Làm lại</button><button id="chooseTestBtn" type="button">Chọn bộ khác</button></div>
      </article>`;
    $("#retryTestBtn").addEventListener("click", () => {
      state.taskIndex = 0; state.answers = {}; state.playCounts = {}; state.startedAt = new Date().toISOString(); renderTask();
    });
    $("#chooseTestBtn").addEventListener("click", ensureSelector);
  }

  Promise.all([
    loadJson("/aptis/data/listening/manifest-v1.json"),
    loadJson("/aptis/data/listening/bank-v1.json")
  ]).then(([manifest, bank]) => {
    updateStatus(manifest);
    state.bank = bank;
    ensureSelector();
  }).catch((error) => {
    console.error(error);
    $("#listeningStatus").innerHTML = `<strong>Không tải được dữ liệu</strong><span>${escapeHtml(error.message)}</span>`;
  });
})();
