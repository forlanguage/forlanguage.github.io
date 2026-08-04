(() => {
  "use strict";
  const dimensions=["task_fulfilment","fluency","grammar_accuracy","vocabulary_range","pronunciation","coherence"];
  const labels={task_fulfilment:"Task fulfilment",fluency:"Fluency",grammar_accuracy:"Grammar accuracy",vocabulary_range:"Vocabulary range",pronunciation:"Pronunciation",coherence:"Coherence"};
  const host=document.getElementById("speakingSelfReview");
  if(!host)return;
  host.innerHTML=`<h2>B2 self-assessment</h2><p class="review-disclaimer">Tự đánh giá để theo dõi tiến bộ; đây không phải điểm Aptis chính thức.</p><div class="speaking-ratings">${dimensions.map(key=>`<label>${labels[key]}<select data-speaking-rating="${key}"><option value="">Chưa đánh giá</option><option value="1">1 · Cần cải thiện</option><option value="2">2 · Đang phát triển</option><option value="3">3 · Đạt mục tiêu B2</option><option value="4">4 · Tốt</option></select></label>`).join("")}</div><label>Ghi chú tổng kết<textarea id="speakingReviewNote" placeholder="Điểm mạnh, lỗi cần sửa và mục tiêu cho lần luyện tiếp theo..."></textarea></label>`;

  function collect(){
    const ratings={};document.querySelectorAll("[data-speaking-rating]").forEach(el=>{if(el.value)ratings[el.dataset.speakingRating]=Number(el.value)});
    const values=Object.values(ratings);return{rubric_id:"SPK-RUB-B2-GENERAL",ratings,average:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100:null,note:document.getElementById("speakingReviewNote")?.value.trim()||"",completed_at:new Date().toISOString(),disclaimer:"Self-assessment only; not an official Aptis score."};
  }

  async function latestInProgress(){const attempts=await AptisAttemptStore.listAttempts();return attempts.filter(a=>a.module==="speaking"&&a.status==="in_progress").sort((a,b)=>String(b.updated_at||b.started_at).localeCompare(String(a.updated_at||a.started_at)))[0]||null;}
  const button=document.getElementById("completeSession"),original=button?.onclick;
  if(button&&original)button.onclick=async event=>{try{const attempt=await latestInProgress();if(attempt){attempt.self_assessment=collect();attempt.review_status="self_reviewed";await AptisAttemptStore.saveAttempt(attempt);}}catch(error){console.warn("Unable to save Speaking self-assessment",error)}return original.call(button,event);};
})();
