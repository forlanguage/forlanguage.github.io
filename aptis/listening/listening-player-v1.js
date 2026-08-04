(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const labels = "ABCDEFGHIJ";
  const state = { bank:null,test:null,taskIndex:0,playCounts:{},answers:{},submitted:false,startedAt:null,attemptId:null,saveTimer:null };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char]);
  async function loadJson(path){const response=await fetch(path,{cache:"no-store"});if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);return response.json();}
  function updateStatus(manifest){$("#listeningStatus").innerHTML=`<strong>${escapeHtml(manifest.status)}</strong><span>${manifest.test_count} test · ${manifest.task_count} tasks · ${manifest.item_count} items</span><span>Version ${escapeHtml(manifest.version)}</span>`;}
  function currentTask(){return state.test.tasks[state.taskIndex];}
  function responseSnapshot(){
    if(!state.test)return[];
    return state.test.tasks.flatMap(task=>task.items.map(item=>({item_id:item.item_id,task_id:task.task_id,part:task.part,question:item.question,user_label:state.answers[item.item_id]||null,correct_label:item.correct,correct_value:item.correct_value,explanation_vi:item.explanation_vi,is_correct:null})));
  }
  async function persistProgress(){
    if(!state.test||!state.attemptId||!window.AptisAttemptStore)return;
    await AptisAttemptStore.saveAttempt({attempt_id:state.attemptId,result_id:state.attemptId,module:"listening",test_id:state.test.test_id,mode:state.test.tasks.length>1?"listening_full_demo":"listening_quick_demo",mode_label:state.test.title,status:"in_progress",started_at:state.startedAt,updated_at:new Date().toISOString(),current_index:state.taskIndex,play_counts:{...state.playCounts},answers:responseSnapshot(),source:"forlanguage-listening-v1.2"});
  }
  function scheduleSave(){clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>persistProgress().catch(console.error),250);}
  function claimAttempt(){const result=window.AptisTabLock?.claim(state.attemptId,"listening");if(result&&!result.ok){alert("Attempt này đang được mở ở tab khác. Tab hiện tại sẽ quay về màn hình chọn bài.");state.attemptId=null;ensureSelector();return false;}return true;}
  function startTest(test){
    state.test=test;state.taskIndex=0;state.playCounts={};state.answers={};state.submitted=false;state.startedAt=new Date().toISOString();state.attemptId=`ATT-L-${Date.now()}`;
    if(!claimAttempt())return;persistProgress().catch(console.error);renderTask();
  }
  function ensureSelector(){
    AptisTabLock?.release();
    $("#practiceHost").innerHTML=`<div class="practice-card test-picker"><label>Chọn bộ Listening<select id="listeningTestSelect">${state.bank.tests.map(test=>`<option value="${test.test_id}">${test.test_id} · ${escapeHtml(test.title)}</option>`).join("")}</select></label><button id="startListeningBtn" type="button">Bắt đầu</button></div>`;
    $("#startListeningBtn").addEventListener("click",()=>startTest(state.bank.tests.find(test=>test.test_id===$("#listeningTestSelect").value)));
  }
  function renderTask(){
    speechSynthesis?.cancel?.();const task=currentTask();const playCount=state.playCounts[task.task_id]||0;
    $("#practiceHost").innerHTML=`<article class="practice-card"><div class="practice-meta"><span>${state.test.test_id}</span><span>Part ${task.part}</span><span>Task ${state.taskIndex+1}/${state.test.tasks.length}</span><span>${state.test.level}</span></div><h2>${escapeHtml(task.instructions_vi)}</h2><div class="audio-panel"><button id="playAudioBtn" type="button" ${playCount>=task.max_plays?"disabled":""}>▶ Nghe audio</button><span id="playCounter">Lượt nghe: ${playCount}/${task.max_plays}</span><small>${task.audio.audio_url?"Audio file":"Bản demo dùng giọng đọc của trình duyệt."}</small><audio id="audioElement" preload="metadata"></audio></div><div class="task-items">${task.items.map(item=>`<section class="question-block"><small>Question ID: ${item.item_id}</small><h3>${escapeHtml(item.question)}</h3><div class="answer-list">${item.options.map((option,index)=>{const label=labels[index];return`<label><input type="radio" name="${item.item_id}" value="${label}" ${state.answers[item.item_id]===label?"checked":""}><b>${label}.</b> ${escapeHtml(option)}</label>`;}).join("")}</div></section>`).join("")}</div><div class="practice-actions"><button id="prevListeningBtn" type="button" ${state.taskIndex===0?"disabled":""}>← Trước</button><button id="nextListeningBtn" type="button">${state.taskIndex===state.test.tasks.length-1?"Nộp bài":"Tiếp →"}</button></div></article>`;
    $("#playAudioBtn").addEventListener("click",playAudio);
    task.items.forEach(item=>document.querySelectorAll(`input[name="${item.item_id}"]`).forEach(input=>input.addEventListener("change",()=>{state.answers[item.item_id]=input.value;scheduleSave();})));
    $("#prevListeningBtn").addEventListener("click",()=>{state.taskIndex-=1;scheduleSave();renderTask();});
    $("#nextListeningBtn").addEventListener("click",()=>{if(state.taskIndex<state.test.tasks.length-1){state.taskIndex+=1;scheduleSave();renderTask();}else submitTest();});
  }
  function speakFallback(task){if(!("speechSynthesis" in window)){alert("Trình duyệt không hỗ trợ giọng đọc demo.");return false;}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(task.audio.transcript);utterance.lang="en-GB";utterance.rate=.92;speechSynthesis.speak(utterance);return true;}
  function playAudio(){const task=currentTask();const count=state.playCounts[task.task_id]||0;if(count>=task.max_plays)return;const increment=()=>{state.playCounts[task.task_id]=count+1;$("#playCounter").textContent=`Lượt nghe: ${count+1}/${task.max_plays}`;if(count+1>=task.max_plays)$("#playAudioBtn").disabled=true;scheduleSave();};if(task.audio.audio_url){const audio=$("#audioElement");audio.src=task.audio.audio_url;audio.currentTime=0;audio.play().then(increment).catch(()=>{if(speakFallback(task))increment();});}else if(speakFallback(task))increment();}
  async function submitTest(){
    const answers=responseSnapshot().map(answer=>({...answer,is_correct:answer.user_label===answer.correct_label}));const correct=answers.filter(a=>a.is_correct).length;const blank=answers.filter(a=>!a.user_label).length;const percent=Math.round(correct*100/answers.length);
    await AptisAttemptStore.saveAttempt({attempt_id:state.attemptId,result_id:state.attemptId,module:"listening",mode:state.test.tasks.length>1?"listening_full_demo":"listening_quick_demo",mode_label:state.test.title,test_id:state.test.test_id,status:"completed",started_at:state.startedAt,submitted_at:new Date().toISOString(),current_index:state.taskIndex,score:{correct,total:answers.length,percent,blank},answers,play_counts:state.playCounts,source:"forlanguage-listening-v1.2"});
    AptisTabLock?.release();renderReview(answers,correct,percent);
  }
  function renderReview(answers,correct,percent){const taskMap=Object.fromEntries(state.test.tasks.map(task=>[task.task_id,task]));$("#practiceHost").innerHTML=`<article class="practice-card"><div class="result-overview"><strong>${correct}/${answers.length}</strong><span>${percent}%</span></div><h2>Review ${escapeHtml(state.test.title)}</h2>${answers.map(answer=>{const task=taskMap[answer.task_id];return`<section class="listening-result ${answer.is_correct?"correct":"wrong"}"><small>${answer.item_id} · Part ${answer.part}</small><h3>${escapeHtml(answer.question)}</h3><p>Bạn chọn: ${escapeHtml(answer.user_label||"Chưa trả lời")} · Đáp án: ${answer.correct_label} — ${escapeHtml(answer.correct_value)}</p><p>${escapeHtml(answer.explanation_vi)}</p><details><summary>Transcript</summary><p>${escapeHtml(task.audio.transcript)}</p></details></section>`;}).join("")}<div class="practice-actions"><button id="retryTestBtn" type="button">Làm lại</button><button id="chooseTestBtn" type="button">Chọn bộ khác</button></div></article>`;$("#retryTestBtn").onclick=()=>startTest(state.test);$("#chooseTestBtn").onclick=ensureSelector;}
  async function resumeFromHandoff(){
    let payload=null;try{payload=JSON.parse(sessionStorage.getItem("aptisResumeAttempt")||"null");}catch{}sessionStorage.removeItem("aptisResumeAttempt");
    const requested=new URLSearchParams(location.search).get("resume");if(!payload&&requested)payload=await AptisAttemptStore.getAttempt(requested);if(!payload||payload.module!=="listening"||payload.status!=="in_progress")return false;
    const test=state.bank.tests.find(row=>row.test_id===payload.test_id);if(!test)return false;
    state.test=test;state.attemptId=payload.attempt_id;state.startedAt=payload.started_at||new Date().toISOString();state.taskIndex=Math.min(Number(payload.current_index||0),test.tasks.length-1);state.playCounts={...(payload.play_counts||{})};state.answers={};(payload.responses||payload.answers||[]).forEach(a=>{if(a.item_id&&a.user_label)state.answers[a.item_id]=a.user_label;});
    if(!claimAttempt())return true;renderTask();alert(`Đã khôi phục Listening tại task ${state.taskIndex+1}/${test.tasks.length}.`);return true;
  }
  document.addEventListener("aptis:lock-conflict",()=>alert("Phát hiện cùng attempt đang hoạt động ở tab khác. Hãy chỉ tiếp tục ở một tab để tránh ghi đè dữ liệu."));
  Promise.all([loadJson("/aptis/data/listening/manifest-v1.json"),loadJson("/aptis/data/listening/bank-v1.json")]).then(async([manifest,bank])=>{updateStatus(manifest);state.bank=bank;if(!(await resumeFromHandoff()))ensureSelector();}).catch(error=>{$("#listeningStatus").innerHTML=`<strong>Không tải được dữ liệu</strong><span>${escapeHtml(error.message)}</span>`;});
})();
