(() => {
  "use strict";
  const dimensions = [
    ["task_fulfilment", "Task fulfilment", "Tôi trả lời đầy đủ yêu cầu của đề."],
    ["grammar_accuracy", "Grammar accuracy", "Cấu trúc câu nhìn chung chính xác và phù hợp B2."],
    ["vocabulary_range", "Vocabulary range", "Tôi dùng từ vựng đủ đa dạng và đúng ngữ cảnh."],
    ["cohesion", "Cohesion", "Các ý được nối rõ ràng và dễ theo dõi."],
    ["register", "Register", "Giọng văn phù hợp với người nhận và mức độ trang trọng."],
    ["word_limit", "Word limit", "Tôi kiểm soát số từ theo yêu cầu từng task."]
  ];

  function ensurePanel() {
    if (document.querySelector("#writingSelfReview")) return;
    const panel = document.createElement("section");
    panel.id = "writingSelfReview";
    panel.className = "self-review-panel";
    panel.innerHTML = `
      <div class="self-review-head">
        <div><p class="eyebrow">B2 SELF-ASSESSMENT</p><h2>Tự đánh giá trước khi nộp</h2></div>
        <span>Đây không phải điểm Aptis chính thức.</span>
      </div>
      <div class="rubric-grid">
        ${dimensions.map(([id, title, hint]) => `
          <label class="rubric-item">
            <span><strong>${title}</strong><small>${hint}</small></span>
            <select data-rubric="${id}">
              <option value="">Chưa đánh giá</option>
              <option value="1">1 · Cần cải thiện</option>
              <option value="2">2 · Đang phát triển</option>
              <option value="3">3 · Đạt mục tiêu B2</option>
              <option value="4">4 · Tốt</option>
            </select>
          </label>`).join("")}
      </div>
      <label class="review-note">Ghi chú tự đánh giá<textarea id="writingReviewNote" placeholder="Điểm mạnh, lỗi cần sửa, mục tiêu cho lần sau..."></textarea></label>`;
    document.querySelector(".writing-actions")?.before(panel);
  }

  function collect() {
    ensurePanel();
    const ratings = {};
    document.querySelectorAll("[data-rubric]").forEach(select => {
      ratings[select.dataset.rubric] = select.value ? Number(select.value) : null;
    });
    const values = Object.values(ratings).filter(Number.isFinite);
    return {
      rubric_id: "WR-RUB-B2-GENERAL",
      ratings,
      average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null,
      note: document.querySelector("#writingReviewNote")?.value.trim() || "",
      completed_at: new Date().toISOString(),
      disclaimer: "Self-assessment only; not an official Aptis score."
    };
  }

  function reset() {
    document.querySelectorAll("[data-rubric]").forEach(select => { select.value = ""; });
    const note = document.querySelector("#writingReviewNote");
    if (note) note.value = "";
  }

  document.addEventListener("DOMContentLoaded", ensurePanel);
  window.addEventListener("aptis-writing-rendered", ensurePanel);
  window.AptisWritingSelfReview = { collect, reset, dimensions };
})();
