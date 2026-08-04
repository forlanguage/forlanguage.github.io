(() => {
  "use strict";
  let payload=null;try{payload=JSON.parse(sessionStorage.getItem("aptisListeningRetryWrong")||"null")}catch{}
  if(!payload?.test_id||!Array.isArray(payload.item_ids)||!payload.item_ids.length)return;
  const wanted=new Set(payload.item_ids);
  const wait=(fn,tries=100)=>new Promise((resolve,reject)=>{const tick=()=>{const v=fn();if(v)return resolve(v);if(--tries<=0)return reject(new Error("Listening retry UI not ready"));setTimeout(tick,100)};tick()});
  function filterQuestions(){document.querySelectorAll(".question-block").forEach(card=>{const id=card.querySelector("small")?.textContent?.replace("Question ID:","").trim();card.hidden=!wanted.has(id)});const visible=[...document.querySelectorAll(".question-block")].some(c=>!c.hidden);const note=document.querySelector(".retry-wrong-note")||document.createElement("p");note.className="retry-wrong-note";note.textContent=`Chế độ làm lại câu sai · ${wanted.size} câu từ attempt trước`;document.querySelector(".practice-card")?.prepend(note);if(!visible){const next=document.querySelector("#nextListeningBtn");if(next&&next.textContent.includes("Tiếp"))setTimeout(()=>next.click(),80)}}
  async function start(){await wait(()=>document.querySelector("#listeningTestSelect option"));const select=document.querySelector("#listeningTestSelect");select.value=payload.test_id;document.querySelector("#startListeningBtn").click();await wait(()=>document.querySelector(".question-block"));filterQuestions();const observer=new MutationObserver(()=>{if(document.querySelector(".question-block"))filterQuestions()});observer.observe(document.querySelector("#practiceHost"),{childList:true,subtree:true});sessionStorage.removeItem("aptisListeningRetryWrong")}
  start().catch(console.error);
})();
