(() => {
  "use strict";
  let test=null, timer=null, remaining=3000;
  const $=id=>document.getElementById(id);
  const draftKey=()=>`aptisWritingDraft:${test?.test_id||"WT01"}:${$("modeSelect").value}`;
  const wordCount=text=>(text.trim().match(/\b[\p{L}\p{N}'-]+\b/gu)||[]).length;
  function selectedTasks(){const mode=$("modeSelect").value;return mode==="full"?test.tasks:test.tasks.filter(t=>`part${t.part}`===mode)}
  function controlHtml(task,idx){
    if(task.questions){return task.questions.map((q,i)=>`<div class="answer-block"><label>${q}<span class="word-count" data-count="${task.task_id}-${i}">0 words</span></label>${task.part===1?`<input data-answer="${task.task_id}-${i}" maxlength="80">`:`<textarea data-answer="${task.task_id}-${i}"></textarea>`}</div>`).join("")}
    return `<div class="answer-block"><label>Your response <span class="word-count" data-count="${task.task_id}-0">0 words · target ${task.min_words}-${task.max_words}</span></label><textarea data-answer="${task.task_id}-0"></textarea></div>`
  }
  function render(){const tasks=selectedTasks();$("writingHost").innerHTML=tasks.map((t,i)=>`<article class="writing-task"><p class="eyebrow">PART ${t.part}</p><h2>${t.type.replaceAll("_"," ")}</h2><p class="prompt">${t.prompt}</p>${controlHtml(t,i)}</article>`).join("");restoreDraft();document.querySelectorAll("[data-answer]").forEach(el=>el.addEventListener("input",()=>{updateCount(el);saveDraft(false)}));$("saveDraft").disabled=false;$("submitWriting").disabled=false;$("exportJson").disabled=false;$("printPdf").disabled=false}
  function updateCount(el){const id=el.dataset.answer;const counter=document.querySelector(`[data-count="${id}"]`);if(!counter)return;const task=test.tasks.find(t=>id.startsWith(t.task_id));const n=wordCount(el.value);counter.textContent=`${n} words${task?.min_words?` · target ${task.min_words}-${task.max_words}`:""}`;counter.classList.toggle("warning",Boolean(task?.min_words&&(n<task.min_words||n>task.max_words)))}
  function collect(){return selectedTasks().map(t=>({task_id:t.task_id,part:t.part,responses:[...document.querySelectorAll(`[data-answer^="${t.task_id}-"]`)].map(el=>({text:el.value,word_count:wordCount(el.value)}))}))}
  function saveDraft(show=true){if(!test)return;localStorage.setItem(draftKey(),JSON.stringify({saved_at:new Date().toISOString(),responses:collect()}));if(show)alert("Đã lưu draft trên thiết bị.")}
  function restoreDraft(){let data=null;try{data=JSON.parse(localStorage.getItem(draftKey())||"null")}catch{};if(!data)return;data.responses?.forEach(t=>t.responses?.forEach((r,i)=>{const el=document.querySelector(`[data-answer="${t.task_id}-${i}"]`);if(el){el.value=r.text||"";updateCount(el)}}))}
  function exportJson(){const payload={schema_version:"1.0",module:"writing",test_id:test.test_id,topic:test.topic,mode:$("modeSelect").value,exported_at:new Date().toISOString(),responses:collect()};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));a.download=`aptis-writing-${test.test_id}.json`;a.click()}
  async function submit(){const attemptId=`WRT-${test.test_id}-${Date.now()}`;const responses=collect();await AptisAttemptStore.saveAttempt({attempt_id:attemptId,result_id:attemptId,module:"writing",test_id:test.test_id,mode:$("modeSelect").value,submitted_at:new Date().toISOString(),topic:test.topic,answers:responses,total:responses.length,completed:responses.filter(t=>t.responses.some(r=>r.text.trim())).length});saveDraft(false);alert("Đã lưu bài Writing vào lịch sử trên thiết bị.")}
  function startTimer(){clearInterval(timer);timer=setInterval(()=>{remaining=Math.max(0,remaining-1);$("timer").textContent=`${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(remaining%60).padStart(2,"0")}`;if(!remaining)clearInterval(timer)},1000)}
  $("loadTest").addEventListener("click",async()=>{if(!test){const r=await fetch("/aptis/data/writing/demo-test.json",{cache:"no-store"});test=await r.json();remaining=test.duration_seconds}render()});
  $("saveDraft").addEventListener("click",()=>saveDraft(true));$("exportJson").addEventListener("click",exportJson);$("printPdf").addEventListener("click",()=>window.print());$("submitWriting").addEventListener("click",()=>submit().catch(e=>alert(e.message)));$("startTimer").addEventListener("click",startTimer);
})();
