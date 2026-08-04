(() => {
  "use strict";
  const selected=[];
  const q=s=>document.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  function ensurePanel(){
    let panel=q("#comparePanel");
    if(!panel){panel=document.createElement("section");panel.id="comparePanel";panel.className="compare-panel";q(".history-toolbar").after(panel);}
    panel.innerHTML=selected.length?`<strong>Đã chọn ${selected.length}/2 attempts</strong><span>${selected.map(x=>esc(x)).join(" · ")}</span><button id="runCompare" ${selected.length!==2?"disabled":""}>So sánh</button><button id="clearCompare">Bỏ chọn</button>`:`<span>Chọn hai attempts cùng module để so sánh.</span>`;
    q("#runCompare")?.addEventListener("click",compare);
    q("#clearCompare")?.addEventListener("click",()=>{selected.length=0;decorate();ensurePanel();});
  }
  function decorate(){
    document.querySelectorAll("[data-review]").forEach(button=>{
      const id=button.dataset.review;const group=button.parentElement;if(group.querySelector(`[data-compare="${CSS.escape(id)}"]`))return;
      const compare=document.createElement("button");compare.dataset.compare=id;compare.textContent=selected.includes(id)?"Đã chọn":"So sánh";compare.classList.toggle("selected",selected.includes(id));
      compare.onclick=()=>{const index=selected.indexOf(id);if(index>=0)selected.splice(index,1);else{if(selected.length===2)selected.shift();selected.push(id);}decorate();ensurePanel();};
      group.insertBefore(compare,group.querySelector("[data-json]"));
    });
    document.querySelectorAll("[data-compare]").forEach(button=>{button.textContent=selected.includes(button.dataset.compare)?"Đã chọn":"So sánh";button.classList.toggle("selected",selected.includes(button.dataset.compare));});
  }
  function score(row){return row.score?.total?`${row.score.correct}/${row.score.total} (${row.score.percent??"—"}%)`:`${row.completed??0}/${row.total??0} hoàn thành`;}
  function responseMap(row){return new Map((row.responses||row.answers||[]).map(x=>[x.item_id||x.task_id, x]));}
  async function compare(){
    if(selected.length!==2)return;const [a,b]=await Promise.all(selected.map(id=>AptisAttemptStore.getAttempt(id)));if(!a||!b)return alert("Không tải được attempt.");if(a.module!==b.module)return alert("Chỉ so sánh hai attempts cùng module.");
    const mapA=responseMap(a),mapB=responseMap(b),keys=[...new Set([...mapA.keys(),...mapB.keys()])];
    const rows=keys.map(key=>{const x=mapA.get(key)||{},y=mapB.get(key)||{};const va=x.user_label??x.text??x.note??(x.recorded?"Recorded":"—");const vb=y.user_label??y.text??y.note??(y.recorded?"Recorded":"—");return`<tr><td>${esc(key||"—")}</td><td>${esc(va||"—")}</td><td>${esc(vb||"—")}</td><td>${x.is_correct===y.is_correct?"Giống":"Khác"}</td></tr>`;}).join("");
    q("#reviewTitle").textContent=`So sánh ${a.module}`;
    q("#reviewContent").innerHTML=`<section class="compare-summary"><article><small>Attempt A</small><strong>${esc(a.test_id||a.mode_label)}</strong><span>${esc(score(a))}</span></article><article><small>Attempt B</small><strong>${esc(b.test_id||b.mode_label)}</strong><span>${esc(score(b))}</span></article></section><div class="compare-table"><table><thead><tr><th>ID</th><th>Attempt A</th><th>Attempt B</th><th>Đối chiếu</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Không có response chi tiết.</td></tr>'}</tbody></table></div>`;
    q("#reviewDialog").showModal();
  }
  const observer=new MutationObserver(()=>decorate());observer.observe(q("#historyRows"),{childList:true,subtree:true});ensurePanel();decorate();
})();
