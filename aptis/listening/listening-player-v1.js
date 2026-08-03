(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const state = { bank: null, test: null, task: null, playCount: 0, selected: null, submitted: false };
  const labels = "ABCDEFGHIJ";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  async function loadJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  function updateStatus(manifest) {
    $("#listeningStatus").innerHTML = `
      <strong>${escapeHtml(manifest.status)}</strong>
      <span>${manifest.test_count} test · ${manifest.task_count} task · ${manifest.audio_count} audio · ${manifest.item_count} item</span>
      <span>Published tests: ${manifest.published_test_count} · Demo tests: ${manifest.demo_test_count}</span>
      <span>Version ${escapeHtml(manifest.version)}</span>`;
  }

  function renderPractice() {
    const item = state.task.items[0];
    $("#practiceHost").innerHTML = `
      <article class="practice-card">
        <div class="practice-meta">
          <span>${escapeHtml(state.test.test_id)}</span>
          <span>Part ${state.task.part}</span>
          <span>${escapeHtml(item.item_id)}</span>
          <span>${escapeHtml(state.test.level)}</span>
        </div>
        <h2>${escapeHtml(state.task.instructions_vi)}</h2>
        <div class="audio-panel">
          <button id="playAudioBtn" type="button">▶ Nghe audio</button>
          <span id="playCounter">Lượt nghe: 0/${state.task.max_plays}</span>
          <small>${state.task.audio.audio_url ? "Audio file" : "Demo dùng giọng đọc của trình duyệt vì file audio chưa publish."}</small>
          <audio id="audioElement" preload="metadata"></audio>
        </div>
        <section class="question-block">
          <h3>${escapeHtml(item.question)}</h3>
          <div class="answer-list">
            ${item.options.map((option, index) => `
              <label><input type="radio" name="answer" value="${labels[index]}">
              <b>${labels[index]}.</b> ${escapeHtml(option)}</label>`).join("")}
          </div>
        </section>
        <div class="practice-actions">
          <button id="submitListeningBtn" type="button">Nộp câu trả lời</button>
          <button id="retryListeningBtn" type="button" hidden>Làm lại</button>
        </div>
        <div id="listeningResult" class="listening-result" hidden></div>
      </article>`;

    $("#playAudioBtn").addEventListener("click", playAudio);
    document.querySelectorAll('input[name="answer"]').forEach((input) => {
      input.addEventListener("change", () => { state.selected = input.value; });
    });
    $("#submitListeningBtn").addEventListener("click", submitAnswer);
    $("#retryListeningBtn").addEventListener("click", resetPractice);
  }

  function speakFallback() {
    if (!("speechSynthesis" in window)) {
      alert("Trình duyệt không hỗ trợ bản đọc demo. Hãy dùng Chrome, Edge hoặc Safari mới.");
      return false;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.task.audio.transcript);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    speechSynthesis.speak(utterance);
    return true;
  }

  function playAudio() {
    if (state.submitted) return;
    if (state.playCount >= state.task.max_plays) return;
    const audio = state.task.audio;
    const element = $("#audioElement");
    let started = false;

    if (audio.audio_url) {
      element.src = audio.audio_url;
      element.currentTime = 0;
      element.play().then(() => { started = true; }).catch(() => {
        started = speakFallback();
        if (started) incrementPlay();
      });
      element.onplay = () => {
        if (!started) {
          started = true;
          incrementPlay();
        }
      };
    } else {
      started = speakFallback();
      if (started) incrementPlay();
    }
  }

  function incrementPlay() {
    state.playCount += 1;
    $("#playCounter").textContent = `Lượt nghe: ${state.playCount}/${state.task.max_plays}`;
    if (state.playCount >= state.task.max_plays) {
      $("#playAudioBtn").disabled = true;
      $("#playAudioBtn").textContent = "Đã hết lượt nghe";
    }
  }

  async function submitAnswer() {
    if (!state.selected) {
      alert("Hãy chọn một đáp án trước khi nộp.");
      return;
    }
    const item = state.task.items[0];
    const correct = state.selected === item.correct;
    state.submitted = true;
    document.querySelectorAll('input[name="answer"]').forEach((input) => { input.disabled = true; });
    $("#playAudioBtn").disabled = true;
    $("#submitListeningBtn").hidden = true;
    $("#retryListeningBtn").hidden = false;
    const result = $("#listeningResult");
    result.hidden = false;
    result.className = `listening-result ${correct ? "correct" : "wrong"}`;
    result.innerHTML = `
      <strong>${correct ? "Đúng" : "Chưa đúng"}</strong>
      <p>Bạn chọn: ${escapeHtml(state.selected)} · Đáp án: ${escapeHtml(item.correct)} — ${escapeHtml(item.correct_value)}</p>
      <p>${escapeHtml(item.explanation_vi)}</p>
      <details><summary>Transcript sau khi nộp bài</summary><p>${escapeHtml(state.task.audio.transcript)}</p></details>`;

    const record = {
      attempt_id: `ATT-L-${Date.now()}`,
      result_id: `ATT-L-${Date.now()}`,
      module: "listening",
      mode: "listening_demo",
      mode_label: "Listening Part 1 demo",
      test_id: state.test.test_id,
      reading_test_id: null,
      submitted_at: new Date().toISOString(),
      score: { correct: correct ? 1 : 0, total: 1, percent: correct ? 100 : 0, blank: 0 },
      answers: [{
        item_id: item.item_id,
        section: "Listening",
        test_id: state.test.test_id,
        part: state.task.part,
        user_label: state.selected,
        correct_label: item.correct,
        is_correct: correct,
        explanation_vi: item.explanation_vi
      }],
      play_count: state.playCount,
      source: "forlanguage-listening-v1"
    };
    try {
      await window.AptisAttemptStore?.saveAttempt(record);
    } catch (error) {
      console.error("Unable to save Listening attempt", error);
    }
  }

  function resetPractice() {
    speechSynthesis?.cancel?.();
    state.playCount = 0;
    state.selected = null;
    state.submitted = false;
    renderPractice();
  }

  Promise.all([
    loadJson("/aptis/data/listening/manifest-v1.json"),
    loadJson("/aptis/data/listening/bank-v1.json")
  ]).then(([manifest, bank]) => {
    updateStatus(manifest);
    state.bank = bank;
    state.test = bank.tests[0];
    state.task = state.test.tasks[0];
    renderPractice();
  }).catch((error) => {
    console.error(error);
    $("#listeningStatus").innerHTML = `<strong>Không tải được dữ liệu</strong><span>${escapeHtml(error.message)}</span>`;
    $("#practiceHost").innerHTML = `<div class="practice-card"><p>Không thể tải Listening demo.</p></div>`;
  });
})();
