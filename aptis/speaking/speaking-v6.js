(() => {
  "use strict";

  let test = null;
  let index = 0;
  let stream = null;
  let recorder = null;
  let chunks = [];
  let timer = null;
  let remaining = 0;
  let sessionAttemptId = null;
  let activeObjectUrl = null;

  const $ = (id) => document.getElementById(id);
  const state = { recordings: {}, notes: {}, started_at: null };

  async function loadTest() {
    const response = await fetch("/aptis/data/speaking/demo-test.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    test = await response.json();
  }

  async function requestMic() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Trình duyệt không hỗ trợ microphone recording.");
    if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    $("permissionState").textContent = "Đã cấp quyền";
    $("requestMic").textContent = "Microphone sẵn sàng";
  }

  function clearTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function runCountdown(seconds, label, done) {
    clearTimer();
    remaining = seconds;
    $("timerLabel").textContent = `${label}: ${remaining}s`;
    timer = setInterval(() => {
      remaining -= 1;
      $("timerLabel").textContent = `${label}: ${Math.max(remaining, 0)}s`;
      if (remaining <= 0) {
        clearTimer();
        done();
      }
    }, 1000);
  }

  function extensionFor(mimeType) {
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("ogg")) return "ogg";
    return "webm";
  }

  function render() {
    const task = test.tasks[index];
    const recording = state.recordings[task.task_id] || null;
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;

    $("taskProgress").textContent = `Câu ${index + 1}/${test.tasks.length}`;
    $("partLabel").textContent = `PART ${task.part}`;
    $("promptText").textContent = task.prompt;
    $("topicText").textContent = `Chủ đề: ${task.topic} · Chuẩn bị ${task.preparation_seconds}s · Trả lời ${task.response_seconds}s`;
    $("selfNote").value = state.notes[task.task_id] || "";
    $("prevTask").disabled = index === 0;
    $("taskHost").hidden = false;
    $("recordBtn").disabled = false;
    $("stopBtn").disabled = true;
    $("retryBtn").disabled = !recording;
    $("playback").hidden = !recording;
    $("downloadRecording").hidden = !recording;
    $("timerLabel").textContent = recording ? "Đã ghi âm" : "Sẵn sàng";

    if (recording) {
      activeObjectUrl = URL.createObjectURL(recording.blob);
      $("playback").src = activeObjectUrl;
      $("downloadRecording").href = activeObjectUrl;
      $("downloadRecording").download = `aptis-${test.test_id}-${task.task_id}.${extensionFor(recording.mime_type)}`;
    }
  }

  async function startRecording() {
    if (!stream) await requestMic();
    if (recorder?.state === "recording") return;
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const task = test.tasks[index];
      state.recordings[task.task_id] = {
        blob,
        mime_type: blob.type,
        duration_seconds: task.response_seconds,
        created_at: new Date().toISOString()
      };
      await saveCurrent();
      render();
    };
    recorder.start(500);
    $("recordBtn").disabled = true;
    $("stopBtn").disabled = false;
    runCountdown(test.tasks[index].response_seconds, "Đang ghi", () => {
      if (recorder?.state === "recording") recorder.stop();
    });
  }

  async function saveCurrent() {
    if (!test || !sessionAttemptId) return;
    const task = test.tasks[index];
    state.notes[task.task_id] = $("selfNote").value;
    const recording = state.recordings[task.task_id];
    if (recording && window.AptisAttemptStore) {
      await AptisAttemptStore.saveAsset({
        asset_id: `${sessionAttemptId}-${task.task_id}`,
        attempt_id: sessionAttemptId,
        kind: "speaking_recording",
        task_id: task.task_id,
        part: task.part,
        blob: recording.blob,
        mime_type: recording.mime_type,
        duration_seconds: recording.duration_seconds,
        created_at: recording.created_at
      });
    }
  }

  async function finalize() {
    await saveCurrent();
    const answers = test.tasks.map((task) => ({
      task_id: task.task_id,
      part: task.part,
      prompt: task.prompt,
      note: state.notes[task.task_id] || "",
      recorded: Boolean(state.recordings[task.task_id]),
      mime_type: state.recordings[task.task_id]?.mime_type || null
    }));
    await AptisAttemptStore.saveAttempt({
      attempt_id: sessionAttemptId,
      result_id: sessionAttemptId,
      module: "speaking",
      test_id: test.test_id,
      mode: "full_demo",
      mode_label: test.title,
      started_at: state.started_at,
      submitted_at: new Date().toISOString(),
      answers,
      completed: answers.filter((answer) => answer.recorded).length,
      total: answers.length,
      score: null,
      source: "forlanguage-speaking-v1.1"
    });
    $("downloadAll").disabled = false;
    renderReview(answers);
  }

  function renderReview(answers) {
    $("taskHost").hidden = true;
    const section = document.createElement("section");
    section.className = "speaking-review";
    section.innerHTML = `
      <h2>Review phiên Speaking</h2>
      <p>Đã ghi ${answers.filter((answer) => answer.recorded).length}/${answers.length} câu. File audio vẫn được lưu cục bộ trên thiết bị.</p>
      ${answers.map((answer) => {
        const recording = state.recordings[answer.task_id];
        const url = recording ? URL.createObjectURL(recording.blob) : "";
        return `<article class="prompt-card"><small>${answer.task_id} · Part ${answer.part}</small><h3>${answer.prompt}</h3>
          <p>${answer.note ? `Ghi chú: ${answer.note}` : "Chưa có ghi chú tự đánh giá."}</p>
          ${recording ? `<audio controls src="${url}"></audio><a href="${url}" download="aptis-${test.test_id}-${answer.task_id}.${extensionFor(recording.mime_type)}">Tải recording</a>` : "<p>Chưa có recording.</p>"}
        </article>`;
      }).join("")}
      <button id="newSpeakingSession" type="button">Luyện lại từ đầu</button>`;
    document.querySelector(".speaking-page").appendChild(section);
    $("newSpeakingSession").addEventListener("click", () => location.reload());
  }

  function exportMetadata() {
    const payload = {
      schema_version: "1.1",
      module: "speaking",
      attempt_id: sessionAttemptId,
      test_id: test.test_id,
      exported_at: new Date().toISOString(),
      answers: test.tasks.map((task) => ({
        task_id: task.task_id,
        part: task.part,
        prompt: task.prompt,
        note: state.notes[task.task_id] || "",
        recorded: Boolean(state.recordings[task.task_id]),
        mime_type: state.recordings[task.task_id]?.mime_type || null
      }))
    };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    link.download = `aptis-speaking-${test.test_id}-${sessionAttemptId}.json`;
    link.click();
  }

  $("requestMic").addEventListener("click", () => requestMic().catch((error) => alert(`Không thể dùng microphone: ${error.message}`)));
  $("startPractice").addEventListener("click", async () => {
    if (!test) await loadTest();
    sessionAttemptId = `SPK-${test.test_id}-${Date.now()}`;
    state.started_at = new Date().toISOString();
    index = 0;
    render();
  });
  $("prepareBtn").addEventListener("click", () => runCountdown(test.tasks[index].preparation_seconds, "Chuẩn bị", () => startRecording().catch((error) => alert(error.message))));
  $("recordBtn").addEventListener("click", () => startRecording().catch((error) => alert(error.message)));
  $("stopBtn").addEventListener("click", () => { clearTimer(); if (recorder?.state === "recording") recorder.stop(); });
  $("retryBtn").addEventListener("click", () => {
    const taskId = test.tasks[index].task_id;
    state.recordings[taskId] = null;
    render();
  });
  $("prevTask").addEventListener("click", async () => { await saveCurrent(); if (index > 0) { index -= 1; render(); } });
  $("saveNext").addEventListener("click", async () => {
    await saveCurrent();
    if (index < test.tasks.length - 1) { index += 1; render(); }
    else await finalize();
  });
  $("downloadAll").addEventListener("click", exportMetadata);

  window.addEventListener("beforeunload", () => {
    clearTimer();
    stream?.getTracks?.().forEach((track) => track.stop());
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  });

  loadTest().catch(console.error);
})();
