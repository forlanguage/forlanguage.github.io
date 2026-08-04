(() => {
  "use strict";
  let bank=null,test=null,tasks=[],index=0,timer=null,sessionAttemptId=null,activeUrl=null,lastPart=null,preflightReady=false;
  const $=id=>document.getElementById(id);
  const state={recordings:{},notes:{},started_at:null,mode:"full",scope:null};
  const media=new AptisMediaRecorderService({minDurationMs:800});
  const partInstructions={
    1:["Part 1 · Personal response","Answer directly and add one or two supporting details."],
    2:["Part 2 · Describe and explain","Describe the situation clearly, then explain why it matters."],
    3:["Part 3 · Compare and choose","Compare both sides, state your preference and support it."],
    4:["Part 4 · Extended response","Use your preparation time to organise an introduction, main ideas and conclusion."]
  };
  const ext=m=>m?.includes("mp4")?"m4a":m?.includes("ogg")?"ogg":"webm";
  const currentTask=()=>tasks[index];

  async function loadBank(){
    const r=await fetch("/aptis/data/speaking/bank-v2.json",{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    bank=await r.json();if(bank.schema_version!=="2.0.0")throw new Error("Unsupported Speaking bank schema");
    $("testSelect").innerHTML=bank.tests.map(row=>`<option value="${row.test_id}">${row.test_id} · ${row.title}</option>`).join("");
    $("topicSelect").innerHTML=bank.topics.map(row=>`<option value="${row.topic_id}">${row.title_en}</option>`).join("");
    selectTest();
  }

  function selectTest(){test=bank.tests.find(row=>row.test_id===$("testSelect").value)||bank.tests[0];}
  function configureMode(){
    const mode=$("practiceMode").value;state.mode=mode;
    $("partSelectWrap").hidden=mode!=="part";$("topicSelectWrap").hidden=mode!=="topic";
  }
  function buildTaskScope(){
    selectTest();const mode=$("practiceMode").value;
    if(mode==="part"){state.scope=$("partSelect").value;return test.tasks.filter(t=>String(t.part)===state.scope);}
    if(mode==="topic"){state.scope=$("topicSelect").value;return test.tasks.filter(t=>t.topic_id===state.scope);}
    state.scope="all";return [...test.tasks];
  }

  async function mic(){
    await media.requestMicrophone();preflightReady=true;$("permissionState").textContent="Preflight đạt";$("requestMic").textContent="Kiểm tra lại microphone";$("micHint").textContent="Hãy nói thử và kiểm tra mức tín hiệu.";
  }
  media.onLevel(level=>{const meter=$("micLevel");if(meter)meter.value=level;const hint=$("micHint");if(hint&&media.stream?.active)hint.textContent=level<0.04?"Tín hiệu rất nhỏ — hãy nói gần microphone hơn.":level>0.85?"Tín hiệu quá lớn — hãy lùi xa microphone một chút.":"Mức tín hiệu phù hợp.";});

  function clearTimer(){if(timer)clearInterval(timer);timer=null;}
  function countdown(seconds,label,done){clearTimer();let left=seconds;$("timerLabel").textContent=`${label}: ${left}s`;timer=setInterval(()=>{left-=1;$("timerLabel").textContent=`${label}: ${Math.max(left,0)}s`;if(left<=0){clearTimer();done();}},1000);}

  function updateOverview(){
    $("sessionOverview").hidden=false;$("sessionTitle").textContent=`${test.test_id} · ${test.title}`;
    const modeLabel=state.mode==="full"?"Full Test":state.mode==="part"?`Practice Part ${state.scope}`:`Practice topic: ${bank.topics.find(t=>t.topic_id===state.scope)?.title_en||state.scope}`;
    $("sessionModeLabel").textContent=modeLabel;
    $("progressMap").innerHTML=tasks.map((task,i)=>`<button type="button" class="progress-dot ${i===index?"active":""} ${state.recordings[task.task_id]?"recorded":"missing"}" data-jump="${i}" aria-label="Câu ${i+1}">${i+1}</button>`).join("");
    document.querySelectorAll("[data-jump]").forEach(button=>button.onclick=async()=>{await saveCurrent();index=Number(button.dataset.jump);showPartGate(true);});
  }

  function renderImage(task){
    const id=task.image_ids?.[0],image=bank.images?.find(row=>row.image_id===id),stage=$("imageStage");
    if(!image){stage.hidden=true;$("taskImage").removeAttribute("src");return;}
    stage.hidden=false;$("taskImage").src=image.file_path;$("taskImage").alt=image.alt_text||"Speaking prompt image";$("imageCaption").textContent=image.attribution||image.source||"";
  }

  function renderTask(){
    const task=currentTask(),recording=state.recordings[task.task_id];if(activeUrl)URL.revokeObjectURL(activeUrl);activeUrl=null;
    $("partInstructions").hidden=true;$("finalReview").hidden=true;$("taskHost").hidden=false;
    $("taskProgress").textContent=`Câu ${index+1}/${tasks.length}`;$("partLabel").textContent=`PART ${task.part}`;$("promptText").textContent=task.prompt;
    $("topicText").textContent=`Chủ đề: ${task.topic} · Chuẩn bị ${task.preparation_seconds}s · Trả lời ${task.response_seconds}s`;$("selfNote").value=state.notes[task.task_id]||"";renderImage(task);
    $("prevTask").disabled=index===0;$("recordBtn").disabled=!preflightReady;$("stopBtn").disabled=true;$("retryBtn").disabled=!recording;$("playback").hidden=!recording;$("downloadRecording").hidden=!recording;
    $("timerLabel").textContent=recording?"Đã có recording":"Sẵn sàng";$("recordingInfo").textContent=recording?`${recording.duration_seconds}s · ${Math.round((recording.size_bytes||recording.blob.size)/1024)} KB`:"";
    $("saveNext").textContent=index===tasks.length-1?"Đến final review →":"Lưu và tiếp →";
    if(recording){activeUrl=URL.createObjectURL(recording.blob);$("playback").src=activeUrl;$("downloadRecording").href=activeUrl;$("downloadRecording").download=`aptis-${test.test_id}-${task.task_id}.${ext(recording.mime_type)}`;}
    updateOverview();lastPart=task.part;
  }

  function showPartGate(force=false){
    const task=currentTask();if(!force&&lastPart===task.part){renderTask();return;}
    const [title,text]=partInstructions[task.part];$("taskHost").hidden=true;$("finalReview").hidden=true;$("partInstructions").hidden=false;$("instructionPart").textContent=`PART ${task.part}`;$("instructionTitle").textContent=title;$("instructionText").textContent=text;updateOverview();
  }

  async function startRecording(){await mic();if(media.recorder?.state==="recording")return;await media.start();$("recordBtn").disabled=true;$("stopBtn").disabled=false;$("recordingInfo").textContent="Đang ghi âm…";countdown(currentTask().response_seconds,"Đang ghi",()=>stopRecording().catch(e=>alert(e.message)));}
  async function stopRecording(){clearTimer();if(media.recorder?.state!=="recording")return;const task=currentTask(),recording=await media.stop();$("recordBtn").disabled=false;$("stopBtn").disabled=true;if(recording.empty){$("recordingInfo").textContent=recording.warning;alert(recording.warning);return;}state.recordings[task.task_id]=recording;await saveCurrent();renderTask();}

  async function saveAttemptProgress(status="in_progress"){
    const responses=tasks.map(t=>({task_id:t.task_id,part:t.part,prompt:t.prompt,topic_id:t.topic_id,image_ids:t.image_ids||[],note:state.notes[t.task_id]||"",recorded:Boolean(state.recordings[t.task_id]),mime_type:state.recordings[t.task_id]?.mime_type||null,duration_seconds:state.recordings[t.task_id]?.duration_seconds||null,size_bytes:state.recordings[t.task_id]?.size_bytes||null}));
    await AptisAttemptStore.saveAttempt({attempt_id:sessionAttemptId,result_id:sessionAttemptId,module:"speaking",test_id:test.test_id,mode:state.mode,mode_label:test.title,status,started_at:state.started_at,submitted_at:status==="completed"?new Date().toISOString():null,updated_at:new Date().toISOString(),responses,completed:responses.filter(r=>r.recorded).length,total:responses.length,score:null,rubric_id:test.rubric_id,bank_release:bank.release?.release_id,session_scope:state.scope,current_index:index,source:"forlanguage-speaking-v2.2"});
  }
  async function saveCurrent(){if(!test||!sessionAttemptId||!currentTask())return;const task=currentTask();state.notes[task.task_id]=$("selfNote").value;const recording=state.recordings[task.task_id];if(recording)await AptisAttemptStore.saveAsset({asset_id:`${sessionAttemptId}-${task.task_id}`,attempt_id:sessionAttemptId,kind:"speaking_recording",task_id:task.task_id,part:task.part,blob:recording.blob,mime_type:recording.mime_type,duration_seconds:recording.duration_seconds,size_bytes:recording.size_bytes,created_at:recording.created_at});await saveAttemptProgress("in_progress");}

  function showFinalReview(){
    $("taskHost").hidden=true;$("partInstructions").hidden=true;$("finalReview").hidden=false;
    const recorded=tasks.filter(t=>state.recordings[t.task_id]).length;$("reviewSummary").textContent=`Đã ghi ${recorded}/${tasks.length} câu. Bạn có thể quay lại từng câu trước khi hoàn tất.`;
    $("reviewItems").innerHTML=tasks.map((task,i)=>`<article class="review-item"><div><strong>Part ${task.part} · Câu ${i+1}</strong><span>${task.prompt}</span><span class="${state.recordings[task.task_id]?"ok":"missing-label"}">${state.recordings[task.task_id]?`${state.recordings[task.task_id].duration_seconds}s · đã lưu`:"Chưa có recording"}</span></div><button type="button" data-review-jump="${i}">Mở câu</button></article>`).join("");
    document.querySelectorAll("[data-review-jump]").forEach(button=>button.onclick=()=>{index=Number(button.dataset.reviewJump);showPartGate(true);});updateOverview();
  }

  async function resume(){
    let payload=null;try{payload=JSON.parse(sessionStorage.getItem("aptisResumeAttempt")||"null");}catch{}
    const id=new URLSearchParams(location.search).get("resume")||payload?.attempt_id;if(!id)return false;const attempt=await AptisAttemptStore.getAttempt(id);if(!attempt||attempt.module!=="speaking")return false;
    test=bank.tests.find(t=>t.test_id===attempt.test_id)||bank.tests[0];$("testSelect").value=test.test_id;state.mode=attempt.mode||"full";state.scope=attempt.session_scope||"all";$("practiceMode").value=state.mode;
    if(state.mode==="part")$("partSelect").value=String(state.scope);if(state.mode==="topic")$("topicSelect").value=state.scope;configureMode();tasks=buildTaskScope();sessionAttemptId=id;state.started_at=attempt.started_at||new Date().toISOString();
    (attempt.responses||attempt.answers||[]).forEach(r=>state.notes[r.task_id]=r.note||"");for(const asset of await AptisAttemptStore.listAssets(id)){if(asset.blob)state.recordings[asset.task_id]={blob:asset.blob,mime_type:asset.mime_type,duration_seconds:asset.duration_seconds,size_bytes:asset.size_bytes||asset.blob.size,created_at:asset.created_at};}
    index=Math.min(Number.isInteger(attempt.current_index)?attempt.current_index:Math.max(0,tasks.findIndex(t=>!state.recordings[t.task_id])),Math.max(tasks.length-1,0));sessionStorage.removeItem("aptisResumeAttempt");preflightReady=true;showPartGate(true);$("downloadAll").disabled=false;return true;
  }

  async function finalize(){await saveCurrent();await saveAttemptProgress("completed");media.stopTracks();alert("Đã hoàn thành và lưu phiên Speaking.");location.href="/aptis/history/";}

  $("requestMic").onclick=()=>mic().catch(e=>{$("permissionState").textContent="Không thể truy cập";alert(e.message)});
  $("practiceMode").onchange=configureMode;$("testSelect").onchange=selectTest;
  $("startPractice").onclick=async()=>{if(!preflightReady){alert("Hãy hoàn tất microphone preflight trước khi bắt đầu.");return;}tasks=buildTaskScope();if(!tasks.length){alert("Không có task phù hợp với lựa chọn này.");return;}sessionAttemptId=`SPK-${test.test_id}-${Date.now()}`;state.started_at=new Date().toISOString();state.recordings={};state.notes={};index=0;lastPart=null;await saveAttemptProgress("in_progress");showPartGate(true);$("downloadAll").disabled=false;};
  $("continueFromInstructions").onclick=renderTask;$("prepareBtn").onclick=()=>countdown(currentTask().preparation_seconds,"Chuẩn bị",()=>startRecording().catch(e=>alert(e.message)));$("recordBtn").onclick=()=>startRecording().catch(e=>alert(e.message));$("stopBtn").onclick=()=>stopRecording().catch(e=>alert(e.message));
  $("retryBtn").onclick=()=>{state.recordings[currentTask().task_id]=null;renderTask();};$("prevTask").onclick=async()=>{await saveCurrent();if(index>0){index-=1;showPartGate();}};$("saveNext").onclick=async()=>{await saveCurrent();if(index<tasks.length-1){index+=1;showPartGate();}else showFinalReview();};
  $("backToTasks").onclick=()=>{index=Math.max(0,tasks.findIndex(t=>!state.recordings[t.task_id]));if(index<0)index=tasks.length-1;showPartGate(true);};$("completeSession").onclick=()=>finalize().catch(e=>alert(e.message));
  $("downloadAll").onclick=()=>{const data={schema_version:"2.0.0",bank_release:bank.release?.release_id,attempt_id:sessionAttemptId,test_id:test.test_id,mode:state.mode,scope:state.scope,responses:tasks.map(t=>({task_id:t.task_id,note:state.notes[t.task_id]||"",recorded:Boolean(state.recordings[t.task_id]),duration_seconds:state.recordings[t.task_id]?.duration_seconds||null,mime_type:state.recordings[t.task_id]?.mime_type||null}))};const a=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.href=url;a.download=`aptis-speaking-${sessionAttemptId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  window.addEventListener("beforeunload",()=>{clearTimer();media.stopTracks();if(activeUrl)URL.revokeObjectURL(activeUrl);});
  loadBank().then(resume).catch(console.error);
})();
