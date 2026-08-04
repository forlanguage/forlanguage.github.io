(() => {
  "use strict";
  const labels={task_fulfilment:"Task fulfilment",grammar_accuracy:"Grammar accuracy",vocabulary_range:"Vocabulary range",cohesion:"Cohesion",register:"Register",word_limit:"Word limit"};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  async function getAttempt(id){return window.AptisAttemptStore?.getAttempt?.(id)}
  async function saveMeta(id,patch){const attempt=await getAttempt(id);if(!attempt)return;await AptisAttemptStore.saveAttempt({...attempt,...patch,review_updated_at:new Date().toISOString()});document.querySelector("#refreshHistory")?.click()}
  async function decorate(){
    document.querySelectorAll("[data-review]").forEach(button=>{if(button.dataset.writingDecorated)return;button.dataset.writingDecorated="1";button.addEventListener("click",()=>setTimeout(async()=>{
      const attempt=await getAttempt(button.dataset.review);if(attempt?.module!=="writing")return;
      const host=document.querySelector("#reviewContent");if(!host)return;
      const assessment=attempt.self_assessment||{},ratings=assessment.ratings||{};
      host.insertAdjacentHTML("afterbegin",`<section class="review-card writing-review-meta"><div class="review-meta-head"><h3>B2 self-assessment</h3><strong>${assessment.average??"—"}/4</strong></div><p class="review-disclaimer">Tự đánh giá, không phải điểm Aptis chính thức.</p><div class="rubric-review-grid">${Object.entries(labels).map(([id,label])=>`<div><span>${label}</span><strong>${ratings[id]??"—"}/4</strong></div>`).join("")}</div><label>Ghi chú review<textarea id="attemptReviewNote">${esc(attempt.review_note||assessment.note||"")}</textarea></label><div class="row-actions"><button id="saveReviewNote" type="button">Lưu ghi chú</button><button id="toggleFavourite" type="button">${attempt.favourite?"Bỏ yêu thích":"Yêu thích"}</button></div></section>`);
      document.querySelector("#saveReviewNote").onclick=()=>saveMeta(attempt.attempt_id,{review_note:document.querySelector("#attemptReviewNote").value.trim(),review_status:"reviewed"});
      document.querySelector("#toggleFavourite").onclick=()=>saveMeta(attempt.attempt_id,{favourite:!attempt.favourite});
    },80))});
  }
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});decorate();
})();
