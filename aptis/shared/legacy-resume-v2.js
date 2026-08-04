(() => {
  "use strict";
  const payloadKey="aptisResumeAttempt";
  let attempt=null;
  try{attempt=JSON.parse(sessionStorage.getItem(payloadKey)||"null");}catch{}
  if(!attempt)return;
  const module=document.body.dataset.aptisModule;
  if(!["core","reading"].includes(module)||attempt.module!==module)return;

  const wait=(fn,tries=160)=>new Promise((resolve,reject)=>{const tick=()=>{const value=fn();if(value)return resolve(value);if(--tries<=0)return reject(new Error("Resume target not ready"));setTimeout(tick,75);};tick();});
  const notice=(text)=>{let box=document.querySelector("#resumeNotice");if(!box){box=document.createElement("div");box.id="resumeNotice";box.className="warning";document.querySelector(".module-banner")?.after(box);}box.textContent=text;};

  function chooseMode(){
    if(module==="reading"&&attempt.test_id){const select=document.querySelector("#readingTestSelect");if(select){select.value=attempt.test_id;select.dispatchEvent(new Event("change",{bubbles:true}));}}
    const mode=attempt.mode|| (module==="reading"?"reading_full":"mini10");
    const button=document.querySelector(`[data-mode="${CSS.escape(mode)}"]`) || (module==="reading"?document.querySelector('[data-mode^="reading"]'):document.querySelector('[data-mode="mini10"]'));
    if(!button)throw new Error(`Không tìm thấy mode ${mode}`);
    button.click();
  }

  function restoreResponses(){
    const responses=attempt.responses||attempt.answers||[];
    let restored=0;
    for(const response of responses){
      const id=response.item_id||response.question_id;
      const value=response.user_label||response.selected||response.answer;
      if(!id||!value)continue;
      const badge=[...document.querySelectorAll("[data-question-id],.question-id-badge,.qid-badge")].find(el=>el.dataset.questionId===id||el.textContent?.includes(id));
      const scope=badge?.closest("article,section,.question,.question-card,.block")||document;
      const input=scope.querySelector(`input[value="${CSS.escape(String(value))}"]`);
      if(input&&!input.checked){input.click();restored+=1;}
    }
    const current=Number(attempt.current_index||attempt.question_index||0);
    for(let i=0;i<current;i++)document.querySelector("#nextBtn:not([disabled])")?.click();
    return restored;
  }

  (async()=>{
    await wait(()=>document.querySelector("[data-mode]"));
    chooseMode();
    await wait(()=>!document.querySelector("#quizView")?.hidden&&document.querySelector("#blockHost"));
    await new Promise(resolve=>setTimeout(resolve,350));
    const restored=restoreResponses();
    notice(`Đã tiếp tục ${module==="reading"?"Reading":"Core"}: khôi phục mode, test và ${restored} câu trả lời nhận diện được. Hãy kiểm tra câu hiện tại trước khi tiếp tục.`);
    sessionStorage.removeItem(payloadKey);
  })().catch(error=>{console.error(error);notice(`Không thể khôi phục sâu: ${error.message}. Bạn vẫn có thể bắt đầu lại cùng mode.`);});
})();
