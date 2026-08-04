(() => {
  "use strict";
  const host = document.querySelector("#listeningStatus");
  let demo = null;
  let plays = 0;
  let selected = "";

  function speak(text) {
    if (!("speechSynthesis" in window)) throw new Error("Trình duyệt không hỗ trợ phát giọng đọc demo.");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.92;
    speechSynthesis.speak(utterance);
  }

  function renderDemo() {
    const task = demo.tasks[0];
    const item = task.items[0];
    const section = document.createElement("section");
    section.className = "listening-demo";
    section.innerHTML = `
      <div class="demo-head"><div><p class="eyebrow">INTERACTIVE DEMO</p><h2>${demo.test_id} · Part ${task.part}</h2></div><span id="playCounter">0/${task.max_plays} lượt nghe</span></div>
      <p>${task.instructions}</p>
      <button id="playDemo" type="button">▶ Phát đoạn nghe</button>
      <article class="demo-question">
        <small>Question ID: ${item.item_id}</small>
        <h3>${item.question}</h3>
        <div id="demoOptions">${item.options.map((option,index)=>`<label><input type="radio" name="demoAnswer" value="${String.fromCharCode(65+index)}"> ${String.fromCharCode(65+index)}. ${option}</label>`).join("")}</div>
        <button id="submitDemo" type="button">Nộp câu trả lời</button>
        <div id="demoResult" hidden></div>
        <details id="transcriptBox" hidden><summary>Transcript</summary><p>${task.audio.transcript}</p></details>
      </article>`;
    document.querySelector(".schema-panel").before(section);

    section.querySelector("#demoOptions").addEventListener("change",event=>{selected=event.target.value;});
    section.querySelector("#playDemo").addEventListener("click",()=>{
      if (plays >= task.max_plays) return;
      plays += 1;
      section.querySelector("#playCounter").textContent=`${plays}/${task.max_plays} lượt nghe`;
      if (task.audio.audio_url) new Audio(task.audio.audio_url).play(); else speak(task.audio.transcript);
      if (plays >= task.max_plays) section.querySelector("#playDemo").disabled=true;
    });
    section.querySelector("#submitDemo").addEventListener("click",async()=>{
      if (!selected) return alert("Hãy chọn một đáp án.");
      const correct=selected===item.correct;
      const result=section.querySelector("#demoResult");
      result.hidden=false;
      result.innerHTML=`<strong>${correct?"Đúng":"Chưa đúng"}</strong><p>Đáp án: ${item.correct}. ${item.options[item.correct.charCodeAt(0)-65]}</p><p>${item.explanation_vi}</p>`;
      section.querySelector("#transcriptBox").hidden=false;
      section.querySelectorAll("input").forEach(input=>input.disabled=true);
      section.querySelector("#submitDemo").disabled=true;
      if(window.AptisAttemptStore){
        const id=`LST-${demo.test_id}-${Date.now()}`;
        await AptisAttemptStore.saveAttempt({attempt_id:id,result_id:id,module:"listening",test_id:demo.test_id,mode:"demo",submitted_at:new Date().toISOString(),answers:[{item_id:item.item_id,selected,correct:item.correct,is_correct:correct}],score:correct?1:0,total:1,play_count:plays});
      }
    });
  }

  Promise.all([
    fetch("/aptis/data/listening/manifest.json",{cache:"no-store"}).then(r=>r.json()),
    fetch("/aptis/data/listening/demo-test.json",{cache:"no-store"}).then(r=>r.json())
  ]).then(([manifest,data])=>{
    demo=data;
    host.innerHTML=`<strong>${manifest.status}</strong><span>${manifest.test_count} test · ${manifest.item_count} item</span><span>Version ${manifest.version}</span>`;
    renderDemo();
  }).catch(error=>{console.error(error);host.innerHTML=`<strong>Không tải được Listening MVP</strong><span>${error.message||error}</span>`;});
})();
