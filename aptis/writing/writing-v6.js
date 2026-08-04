(() => {
  "use strict";
  let bank=null,test=null,timer=null,remaining=3000,startedAt=null,autosaveTimer=null;
  const $=id=>document.getElementById(id);
  const draftKey=()=>`aptisWritingDraft:${test?.test_id||"none"}:${$("modeSelect").value}`;
  const wordCount=text=>(text.trim().match(/\b[\p{L}\p{N}'-]+\b/gu)||[]).length;
  const selectedTasks=()=>$("modeSelect").value==="full"?test.tasks:test.tasks.filter(task=>`part${task.part}`===$("modeSelect").value);

  function controlHtml(task){
    if(task.questions)return task.questions.map((question,index)=>`<div class="answer-block"><label>${question}<span class="word-count" data-count="${task.task_id}-${index}">0 words</span></label>${task.part===1?`<input data-answer="${task.task_id}-${index}" maxlength="100">`:`<textarea data-answer="${task.task_id}-${index}"></textarea>`}</div>`).join("");
    return `<div class="answer-block"><label>Your response <span class="word-count" data-count="${task.task_id}-0">0 words · target ${task.min_words}-${task.max_words}</span></label><textarea data-answer="${task.task_id}-0"></textarea></div>`;
  }

  function updateCount(element){
    const id=element.dataset.answer,counter=document.querySelector(`[data-count="${id}"]`),task=test.tasks.find(row=>id.startsWith(row.task_id)),count=wordCount(element.value);
    if(!counter)return;
    counter.textContent=`${count} words${task?.min_words?` · target ${task.min_words}-${task.max_words}`:""}`;
    counter.classList.toggle("warning",Boolean(task?.min_words&&(count<task.min_words||count>task.max_words)));
  }

  function collect(){return selectedTasks().map(task=>({task_id:task.task_id,part:task.part,type:task.type,prompt:task.prompt,responses:[...document.querySelectorAll(`[data-answer^="${task.task_id}-"]`)].map(element=>({text:element.value,word_count:wordCount(element.value)}))}))}

  function restoreDraft(){
    let data=null;try{data=JSON.parse(localStorage.getItem(draftKey())||"null")}catch{}
    if(!data)return;
    data.responses?.forEach(task=>task.responses?.forEach((response,index)=>{const element=document.querySelector(`[data-answer="${task.task_id}-${index}"]`);if(element){element.value=response.text||"";updateCount(element)}}));
    const status=$("draftStatus");if(status)status.textContent=`Khôi phục draft ${new Date(data.saved_at).toLocaleString("vi-VN")}`;
  }

  function render(){
    $("writingHost").innerHTML=`<div class="writing-context"><strong>${test.test_id} · ${test.title}</strong><span>Common topic: ${test.topic}</span><span>${test.level||"B2"} · ${test.rubric_id||"WR-RUB-B2-GENERAL"}</span><span id="draftStatus">Draft chưa được lưu</span></div>${selectedTasks().map(task=>`<article class="writing-task"><p class="eyebrow">PART ${task.part}</p><h2>${task.type.replaceAll("_"," ")}</h2><p class="prompt">${task.prompt}</p>${controlHtml(task)}</article>`).join("")}`;
    restoreDraft();
    document.querySelectorAll("[data-answer]").forEach(element=>element.addEventListener("input",()=>{updateCount(element);clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>saveDraft(false),700)}));
    ["saveDraft","submitWriting","exportJson","printPdf"].forEach(id=>{$(id).disabled=false});
  }

  function saveDraft(showMessage=true){
    if(!test)return;const savedAt=new Date().toISOString();localStorage.setItem(draftKey(),JSON.stringify({saved_at:savedAt,schema_version:"2.0.0",test_id:test.test_id,responses:collect()}));
    const status=$("draftStatus");if(status)status.textContent=`Đã lưu draft lúc ${new Date(savedAt).toLocaleTimeString("vi-VN")}`;if(showMessage)alert("Đã lưu draft trên thiết bị.");
  }

  function buildPayload(){return{schema_version:"2.0.0",bank_release:bank.release?.release_id,module:"writing",test_id:test.test_id,title:test.title,topic:test.topic,topic_id:test.topic_id,rubric_id:test.rubric_id,mode:$("modeSelect").value,started_at:startedAt,exported_at:new Date().toISOString(),responses:collect()}}
  function exportJson(){const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([JSON.stringify(buildPayload(),null,2)],{type:"application/json"}));link.download=`aptis-writing-${test.test_id}-${$("modeSelect").value}.json`;link.click()}

  async function submit(){
    const payload=buildPayload(),attemptId=`WRT-${test.test_id}-${Date.now()}`;
    await AptisAttemptStore.saveAttempt({attempt_id:attemptId,result_id:attemptId,module:"writing",test_id:test.test_id,mode:payload.mode,mode_label:test.title,started_at:startedAt,submitted_at:new Date().toISOString(),topic:test.topic,topic_id:test.topic_id,rubric_id:test.rubric_id,bank_release:payload.bank_release,answers:payload.responses,total:payload.responses.length,completed:payload.responses.filter(task=>task.responses.some(response=>response.text.trim())).length,score:null,source:"forlanguage-writing-v2"});
    saveDraft(false);alert("Đã lưu bài Writing vào lịch sử trên thiết bị.");
  }

  function startTimer(){clearInterval(timer);startedAt||=new Date().toISOString();timer=setInterval(()=>{remaining=Math.max(0,remaining-1);$("timer").textContent=`${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(remaining%60).padStart(2,"0")}`;if(!remaining)clearInterval(timer)},1000)}

  async function loadBank(){
    const response=await fetch("/aptis/data/writing/bank-v2.json",{cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);bank=await response.json();
    if(bank.schema_version!=="2.0.0")throw new Error("Unsupported Writing bank schema");
    $("testSelect").innerHTML=bank.tests.map(row=>`<option value="${row.test_id}">${row.test_id} · ${row.title}</option>`).join("");
  }

  $("loadTest").addEventListener("click",async()=>{if(!bank)await loadBank();test=bank.tests.find(row=>row.test_id===$("testSelect").value);remaining=test.duration_seconds;startedAt=new Date().toISOString();$("timer").textContent=`${String(Math.floor(remaining/60)).padStart(2,"0")}:00`;render()});
  $("modeSelect").addEventListener("change",()=>{if(test)render()});$("saveDraft").addEventListener("click",()=>saveDraft(true));$("exportJson").addEventListener("click",exportJson);$("printPdf").addEventListener("click",()=>window.print());$("submitWriting").addEventListener("click",()=>submit().catch(error=>alert(error.message)));$("startTimer").addEventListener("click",startTimer);
  loadBank().catch(error=>console.error("Unable to load Writing bank v2",error));
})();
