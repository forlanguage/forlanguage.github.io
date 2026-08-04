(() => {
  "use strict";
  let bank=null,test=null,timer=null,remaining=3000,startedAt=null,activePart=1,paused=true;
  const $=id=>document.getElementById(id);
  const wordCount=text=>(text.trim().match(/\b[\p{L}\p{N}'-]+\b/gu)||[]).length;
  const selectedTasks=()=>$("modeSelect").value==="full"?test.tasks:test.tasks.filter(task=>`part${task.part}`===$("modeSelect").value);
  const visibleParts=()=>[...new Set(selectedTasks().map(task=>task.part))];

  function controlHtml(task){
    if(task.questions)return task.questions.map((question,index)=>`<div class="answer-block"><label>${question}<span class="word-count" data-count="${task.task_id}-${index}">0 words</span></label>${task.part===1?`<input data-answer="${task.task_id}-${index}" maxlength="100">`:`<textarea data-answer="${task.task_id}-${index}"></textarea>`}</div>`).join("");
    return `<div class="answer-block"><label>Your response <span class="word-count" data-count="${task.task_id}-0">0 words · target ${task.min_words}-${task.max_words}</span></label><textarea data-answer="${task.task_id}-0"></textarea></div>`;
  }

  function collect(){return selectedTasks().map(task=>({task_id:task.task_id,part:task.part,type:task.type,prompt:task.prompt,responses:[...document.querySelectorAll(`[data-answer^="${task.task_id}-"]`)].map(element=>({text:element.value,word_count:wordCount(element.value)}))}))}
  function taskComplete(task){const nodes=[...document.querySelectorAll(`[data-answer^="${task.task_id}-"]`)];return nodes.length>0&&nodes.every(node=>node.value.trim())}

  function updateCount(element){
    const id=element.dataset.answer,counter=document.querySelector(`[data-count="${id}"]`),task=test.tasks.find(row=>id.startsWith(row.task_id)),count=wordCount(element.value);
    if(!counter)return;
    counter.textContent=`${count} words${task?.min_words?` · target ${task.min_words}-${task.max_words}`:""}`;
    counter.classList.toggle("warning",Boolean(task?.min_words&&(count<task.min_words||count>task.max_words)));
    counter.classList.toggle("ok",Boolean(task?.min_words&&count>=task.min_words&&count<=task.max_words));
  }

  function updateProgress(){
    if(!test)return;
    const tasks=selectedTasks(),completed=tasks.filter(taskComplete).length,totalWords=[...document.querySelectorAll("[data-answer]")].reduce((sum,node)=>sum+wordCount(node.value),0);
    $("completionSummary").textContent=`${completed}/${tasks.length} task hoàn thành`;
    $("wordSummary").textContent=`${totalWords} từ`;
    document.querySelectorAll("[data-part-nav]").forEach(button=>{const part=Number(button.dataset.partNav),partTasks=tasks.filter(task=>task.part===part);button.classList.toggle("complete",partTasks.length>0&&partTasks.every(taskComplete))});
  }

  function setActivePart(part){
    activePart=part;
    document.querySelectorAll(".writing-task").forEach(card=>{card.hidden=Number(card.dataset.part)!==part});
    document.querySelectorAll("[data-part-nav]").forEach(button=>button.classList.toggle("active",Number(button.dataset.partNav)===part));
    document.querySelector(`.writing-task[data-part="${part}"]`)?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function renderPartNavigation(){
    const parts=visibleParts();$("partNavigation").hidden=false;
    $("partNavigation").innerHTML=parts.map(part=>`<button type="button" data-part-nav="${part}">Part ${part}</button>`).join("");
    document.querySelectorAll("[data-part-nav]").forEach(button=>button.addEventListener("click",()=>setActivePart(Number(button.dataset.partNav))));
    setActivePart(parts.includes(activePart)?activePart:parts[0]);
  }

  function applyExamMode(){
    const exam=$("examModeSelect").value==="exam";
    document.querySelectorAll("[data-answer]").forEach(node=>node.spellcheck=!exam);
    $("modeSelect").disabled=exam;
    if(exam&&$("modeSelect").value!=="full"){$("modeSelect").value="full";render()}
  }

  function render(){
    const tasks=selectedTasks();
    $("writingHost").innerHTML=`<div class="writing-context"><strong>${test.test_id} · ${test.title}</strong><span>${test.topic}</span><span>${test.level||"B2"}</span><span>${test.rubric_id}</span></div>${tasks.map(task=>`<article class="writing-task" data-part="${task.part}"><p class="eyebrow">PART ${task.part}</p><h2>${task.type.replaceAll("_"," ")}</h2><p class="prompt">${task.prompt}</p>${controlHtml(task)}</article>`).join("")}`;
    document.querySelectorAll("[data-answer]").forEach(element=>element.addEventListener("input",()=>{updateCount(element);$("draftStatus").textContent="Đang chờ autosave…";updateProgress()}));
    ["saveDraft","submitWriting","exportJson","printPdf"].forEach(id=>{$(id).disabled=false});
    renderPartNavigation();applyExamMode();updateProgress();
    window.dispatchEvent(new CustomEvent("aptis-writing-rendered",{detail:{test_id:test.test_id,mode:$("modeSelect").value}}));
  }

  function buildPayload(){return{schema_version:"2.0.0",bank_release:bank.release?.release_id,module:"writing",test_id:test.test_id,title:test.title,topic:test.topic,topic_id:test.topic_id,rubric_id:test.rubric_id,mode:$("modeSelect").value,exam_mode:$("examModeSelect").value,started_at:startedAt,remaining_seconds:remaining,exported_at:new Date().toISOString(),responses:collect()}}
  function exportJson(){const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([JSON.stringify(buildPayload(),null,2)],{type:"application/json"}));link.download=`aptis-writing-${test.test_id}-${$("modeSelect").value}.json`;link.click()}

  async function submit(){
    const payload=buildPayload(),attemptId=`WRT-${test.test_id}-${Date.now()}`,responses=payload.responses;
    await AptisAttemptStore.saveAttempt({attempt_id:attemptId,result_id:attemptId,module:"writing",test_id:test.test_id,mode:payload.mode,mode_label:test.title,status:"completed",started_at:startedAt,submitted_at:new Date().toISOString(),duration_seconds:Math.max(0,test.duration_seconds-remaining),remaining_seconds:remaining,exam_mode:payload.exam_mode,topic:test.topic,topic_id:test.topic_id,rubric_id:test.rubric_id,bank_release:payload.bank_release,answers:responses,total:responses.length,completed:responses.filter(task=>task.responses.every(response=>response.text.trim())).length,score:null,source:"forlanguage-writing-editor-v2"});
    paused=true;clearInterval(timer);$("timerState").textContent="Đã nộp";alert("Đã lưu bài Writing vào Review Center.");
  }

  function requestSubmit(){
    const tasks=selectedTasks(),incomplete=tasks.filter(task=>!taskComplete(task));
    $("submitMessage").textContent=incomplete.length?`Bạn còn ${incomplete.length} task chưa hoàn thành. Bạn vẫn muốn nộp bài?`:`Bạn đã hoàn thành ${tasks.length}/${tasks.length} task. Xác nhận nộp bài?`;
    $("submitDialog").showModal();
  }

  function renderTimer(){const minutes=Math.floor(remaining/60),seconds=remaining%60;$("timer").textContent=`${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`}
  function startTimer(){
    if(!test)return alert("Hãy mở một bộ đề trước.");startedAt||=new Date().toISOString();paused=false;$("timerState").textContent="Đang chạy";$("startTimer").disabled=true;$("pauseTimer").disabled=false;clearInterval(timer);
    timer=setInterval(()=>{remaining=Math.max(0,remaining-1);renderTimer();if(!remaining){clearInterval(timer);paused=true;$("timerState").textContent="Hết giờ";requestSubmit()}},1000);
  }
  function pauseTimer(){paused=true;clearInterval(timer);$("timerState").textContent="Đã tạm dừng";$("startTimer").disabled=false;$("pauseTimer").disabled=true}

  async function loadBank(){const response=await fetch("/aptis/data/writing/bank-v2.json",{cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);bank=await response.json();if(bank.schema_version!=="2.0.0")throw new Error("Unsupported Writing bank schema");$("testSelect").innerHTML=bank.tests.map(row=>`<option value="${row.test_id}">${row.test_id} · ${row.title}</option>`).join("")}
  async function openTest(){if(!bank)await loadBank();test=bank.tests.find(row=>row.test_id===$("testSelect").value);remaining=test.duration_seconds;startedAt=new Date().toISOString();activePart=1;paused=true;renderTimer();$("timerState").textContent="Sẵn sàng";$("startTimer").disabled=false;$("pauseTimer").disabled=true;render()}

  $("loadTest").addEventListener("click",()=>openTest().catch(error=>alert(error.message)));
  $("modeSelect").addEventListener("change",()=>{if(test){activePart=Number($("modeSelect").value.replace("part",""))||1;render()}});
  $("examModeSelect").addEventListener("change",applyExamMode);
  $("focusMode").addEventListener("click",()=>{document.body.classList.toggle("focus-writing");$("focusMode").textContent=document.body.classList.contains("focus-writing")?"Thoát focus":"Focus mode"});
  $("exportJson").addEventListener("click",exportJson);$("printPdf").addEventListener("click",()=>window.print());$("submitWriting").addEventListener("click",requestSubmit);$("confirmSubmit").addEventListener("click",event=>{event.preventDefault();$("submitDialog").close();submit().catch(error=>alert(error.message))});$("startTimer").addEventListener("click",startTimer);$("pauseTimer").addEventListener("click",pauseTimer);
  window.addEventListener("beforeunload",event=>{if(test&&!paused){event.preventDefault();event.returnValue=""}});
  window.AptisWritingEditor={getState:()=>({test_id:test?.test_id,mode:$("modeSelect").value,exam_mode:$("examModeSelect").value,remaining_seconds:remaining,active_part:activePart}),setRemaining:value=>{remaining=Math.max(0,Number(value)||0);renderTimer()},setActivePart};
  loadBank().catch(error=>console.error("Unable to load Writing bank v2",error));
})();
