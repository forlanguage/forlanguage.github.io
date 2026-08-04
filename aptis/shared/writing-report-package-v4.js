(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const fmt = iso => iso ? new Intl.DateTimeFormat("vi-VN", {dateStyle:"medium", timeStyle:"short"}).format(new Date(iso)) : "—";
  const labels = {task_fulfilment:"Task fulfilment",grammar_accuracy:"Grammar accuracy",vocabulary_range:"Vocabulary range",cohesion:"Cohesion",register:"Register",word_limit:"Word limit"};

  function normalizeResponses(attempt) {
    return attempt.responses || attempt.answers || [];
  }

  function packageData(attempt) {
    const responses = normalizeResponses(attempt);
    return {
      package_schema: "forlanguage-writing-review-package/1.0",
      generated_at: new Date().toISOString(),
      attempt: {
        attempt_id: attempt.attempt_id,
        test_id: attempt.test_id,
        title: attempt.mode_label || attempt.title || attempt.test_id,
        topic: attempt.topic || null,
        topic_id: attempt.topic_id || null,
        rubric_id: attempt.rubric_id || "WR-RUB-B2-GENERAL",
        bank_release: attempt.bank_release || null,
        mode: attempt.mode || "full",
        exam_mode: attempt.exam_mode || null,
        started_at: attempt.started_at || null,
        submitted_at: attempt.submitted_at || null,
        duration_seconds: attempt.duration_seconds ?? null,
        favourite: Boolean(attempt.favourite),
        review_status: attempt.review_status || null
      },
      responses,
      self_assessment: attempt.self_assessment || null,
      review_note: attempt.review_note || "",
      disclaimer: "This package contains learner practice and self-assessment. It is not an official Aptis score report."
    };
  }

  function downloadJson(attempt) {
    const data = packageData(attempt);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = `writing-${attempt.test_id || "test"}-${attempt.attempt_id}-package.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reportHtml(attempt) {
    const data = packageData(attempt), a = data.attempt, self = data.self_assessment;
    const responseHtml = data.responses.map(task => `<section class="part"><h2>Part ${esc(task.part || "")} · ${esc(task.task_id || "")}</h2>${task.prompt ? `<p class="prompt">${esc(task.prompt)}</p>` : ""}${(task.responses || []).map((r, i) => `<article><h3>Response ${i + 1}</h3><p>${esc(r.text || "").replace(/\n/g,"<br>")}</p><small>${Number(r.word_count || 0)} words</small></article>`).join("")}</section>`).join("");
    const rubricHtml = self ? `<section><h2>B2 self-assessment</h2><p class="notice">Self-assessment only; not an official Aptis score.</p><table><tbody>${Object.entries(self.ratings || {}).map(([key, value]) => `<tr><th>${esc(labels[key] || key)}</th><td>${value ?? "—"} / 4</td></tr>`).join("")}<tr><th>Average</th><td>${self.average ?? "—"} / 4</td></tr></tbody></table>${self.note ? `<h3>Learner note</h3><p>${esc(self.note).replace(/\n/g,"<br>")}</p>` : ""}</section>` : "";
    return `<!doctype html><html><head><meta charset="utf-8"><title>Writing report · ${esc(a.test_id)}</title><style>@page{size:A4;margin:18mm}body{font:14px/1.55 Arial,sans-serif;color:#172033;max-width:180mm;margin:auto}header{border-bottom:3px solid #173e75;padding-bottom:14px;margin-bottom:22px}h1{margin:0;font-size:28px}h2{color:#173e75;margin-top:24px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;margin-top:14px}.part{page-break-inside:avoid;border-top:1px solid #ccd5df}.prompt{background:#f1f5f9;padding:10px}article{margin:12px 0;padding:10px;border:1px solid #d8e0e8;border-radius:8px}article p{white-space:normal}small{color:#5e6b7c}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd5df;padding:8px;text-align:left}.notice{padding:9px;background:#fff7df}.footer{margin-top:28px;border-top:1px solid #ccd5df;padding-top:10px;color:#5e6b7c}@media print{button{display:none}}</style></head><body><header><h1>Aptis Writing Practice Report</h1><p>ForLanguage · learner-owned local report</p><div class="meta"><span><strong>Attempt:</strong> ${esc(a.attempt_id)}</span><span><strong>Test:</strong> ${esc(a.test_id)}</span><span><strong>Title:</strong> ${esc(a.title)}</span><span><strong>Topic:</strong> ${esc(a.topic || "—")}</span><span><strong>Mode:</strong> ${esc(a.mode)}</span><span><strong>Duration:</strong> ${a.duration_seconds == null ? "—" : Math.round(a.duration_seconds / 60) + " min"}</span><span><strong>Started:</strong> ${esc(fmt(a.started_at))}</span><span><strong>Submitted:</strong> ${esc(fmt(a.submitted_at))}</span></div></header>${responseHtml}${rubricHtml}${data.review_note ? `<section><h2>Review note</h2><p>${esc(data.review_note).replace(/\n/g,"<br>")}</p></section>` : ""}<p class="footer">${esc(data.disclaimer)} · Generated ${esc(fmt(data.generated_at))}</p><script>window.addEventListener('load',()=>window.print())<\/script></body></html>`;
  }

  function printReport(attempt) {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return alert("Trình duyệt đã chặn cửa sổ báo cáo. Hãy cho phép pop-up rồi thử lại.");
    popup.document.open();
    popup.document.write(reportHtml(attempt));
    popup.document.close();
  }

  async function getAttempt(id) {
    const rows = await AptisAttemptStore.listAttempts();
    return rows.find(row => row.attempt_id === id && row.module === "writing");
  }

  function wire() {
    document.querySelectorAll("[data-review]").forEach(reviewButton => {
      const cell = reviewButton.closest(".row-actions");
      if (!cell || cell.querySelector(`[data-writing-package="${CSS.escape(reviewButton.dataset.review)}"]`)) return;
      const id = reviewButton.dataset.review;
      const pkg = document.createElement("button"); pkg.type = "button"; pkg.dataset.writingPackage = id; pkg.textContent = "Package";
      const pdf = document.createElement("button"); pdf.type = "button"; pdf.dataset.writingPdf = id; pdf.textContent = "PDF";
      pkg.onclick = async () => { const attempt = await getAttempt(id); if (attempt) downloadJson(attempt); };
      pdf.onclick = async () => { const attempt = await getAttempt(id); if (attempt) printReport(attempt); };
      getAttempt(id).then(attempt => { if (attempt) { cell.append(pkg, pdf); } });
    });
  }

  new MutationObserver(wire).observe(document.documentElement, {subtree:true, childList:true});
  document.addEventListener("DOMContentLoaded", wire);
  window.AptisWritingReportPackage = {packageData, reportHtml, downloadJson, printReport};
})();
