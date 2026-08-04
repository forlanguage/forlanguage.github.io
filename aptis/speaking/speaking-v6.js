(() => {
  "use strict";
  let test = null, index = 0, stream = null, recorder = null, chunks = [], currentBlob = null, timer = null, remaining = 0;
  const $ = (id) => document.getElementById(id);
  const state = { recordings: {}, notes: {} };

  async function loadTest() {
    const response = await fetch("/aptis/data/speaking/demo-test.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    test = await response.json();
  }
  async function requestMic() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    $("permissionState").textContent = "Đã cấp quyền";
    $("requestMic").textContent = "Microphone sẵn sàng";
  }
  function clearTimer(){ if(timer){clearInterval(timer);timer=null;} }
  function runCountdown(seconds, label, done){
    clearTimer(); remaining=seconds; $("timerLabel").textContent=`${label}: ${remaining}s`;
    timer=setInterval(()=>{ remaining-=1; $("timerLabel").textContent=`${label}: ${Math.max(remaining,0)}s`; if(remaining<=0){clearTimer(); done();}},1000);
  }
  function render(){
    const task=test.tasks[index]; currentBlob=state.recordings[task.task_id]?.blob || null;
    $("taskProgress").textContent=`Câu ${index+1}/${test.tasks.length}`;
    $("partLabel").textContent=`PART ${task.part}`; $("promptText").textContent=task.prompt; $("topicText").textContent=`Chủ đề: ${task.topic}`;
    $("selfNote").value=state.notes[task.task_id]||""; $("prevTask").disabled=index===0; $("taskHost").hidden=false;
    $("playback").hidden=!currentBlob; $("downloadRecording").hidden=!currentBlob; $("retryBtn").disabled=!currentBlob;
    if(currentBlob){ const url=URL.createObjectURL(currentBlob); $("playback").src=url; $("downloadRecording").href=url; $("downloadRecording").download=`aptis-${test.test_id}-${task.task_id}.webm`; }
  }
  async function startRecording(){
    if(!stream) await requestMic(); chunks=[]; recorder=new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onstop=()=>{ currentBlob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"}); const task=test.tasks[index]; state.recordings[task.task_id]={blob:currentBlob,mime_type:currentBlob.type,duration_seconds:task.response_seconds}; $("recordBtn").disabled=false; $("stopBtn").disabled=true; render(); };
    recorder.start(); $("recordBtn").disabled=true; $("stopBtn").disabled=false;
    runCountdown(test.tasks[index].response_seconds,"Đang ghi",()=>{ if(recorder?.state==="recording") recorder.stop(); });
  }
  async function saveCurrent(){
    const task=test.tasks[index]; state.notes[task.task_id]=$("selfNote").value;
    const rec=state.recordings[task.task_id];
    if(rec && window.AptisAttemptStore){
      const attemptId=`SPK-${test.test_id}`;
      await AptisAttemptStore.saveAsset({asset_id:`${attemptId}-${task.task_id}`,attempt_id:attemptId,kind:"speaking_recording",task_id:task.task_id,blob:rec.blob,mime_type:rec.mime_type,created_at:new Date().toISOString()});
    }
  }
  async function finalize(){
    await saveCurrent(); const attemptId=`SPK-${test.test_id}-${Date.now()}`;
    const answers=test.tasks.map(t=>({task_id:t.task_id,note:state.notes[t.task_id]||"",recorded:Boolean(state.recordings[t.task_id])}));
    await AptisAttemptStore.saveAttempt({attempt_id:attemptId,result_id:attemptId,module:"speaking",test_id:test.test_id,mode:"practice",submitted_at:new Date().toISOString(),answers,completed:answers.filter(x=>x.recorded).length,total:answers.length});
    $("downloadAll").disabled=false; alert("Đã lưu phiên Speaking trên thiết bị.");
  }
  $("requestMic").addEventListener("click",()=>requestMic().catch(e=>alert(`Không thể dùng microphone: ${e.message}`)));
  $("startPractice").addEventListener("click",async()=>{if(!test)await loadTest();index=0;render();});
  $("prepareBtn").addEventListener("click",()=>runCountdown(test.tasks[index].preparation_seconds,"Chuẩn bị",()=>startRecording().catch(e=>alert(e.message))));
  $("recordBtn").addEventListener("click",()=>startRecording().catch(e=>alert(e.message)));
  $("stopBtn").addEventListener("click",()=>{clearTimer();if(recorder?.state==="recording")recorder.stop();});
  $("retryBtn").addEventListener("click",()=>{currentBlob=null;state.recordings[test.tasks[index].task_id]=null;render();});
  $("prevTask").addEventListener("click",async()=>{await saveCurrent();if(index>0){index--;render();}});
  $("saveNext").addEventListener("click",async()=>{await saveCurrent();if(index<test.tasks.length-1){index++;render();}else await finalize();});
  $("downloadAll").addEventListener("click",()=>{const payload={test_id:test.test_id,exported_at:new Date().toISOString(),answers:test.tasks.map(t=>({task_id:t.task_id,note:state.notes[t.task_id]||"",recorded:Boolean(state.recordings[t.task_id])}))};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));a.download=`aptis-speaking-${test.test_id}.json`;a.click();});
  loadTest().catch(console.error);
})();
