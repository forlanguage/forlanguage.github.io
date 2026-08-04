(() => {
  "use strict";

  const q = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
  const fmt = (iso) => { try { return iso ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "—"; } catch { return iso || "—"; } };
  const moduleName = (value) => ({core:"Grammar & Vocabulary",reading:"Reading",listening:"Listening",speaking:"Speaking",writing:"Writing",unknown:"Khác"})[value] || value || "Khác";
  const byteText = (bytes) => { const value=Number(bytes||0); if(value<1024)return `${value} B`; if(value<1024**2)return `${(value/1024).toFixed(1)} KB`; return `${(value/1024**2).toFixed(1)} MB`; };
  let rows = [];
  const objectUrls = new Set();

  function downloadJson(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filteredRows() {
    const module = q("#moduleFilter").value;
    const term = q("#historySearch").value.trim().toLowerCase();
    return rows.filter((row) => {
      if (module !== "all" && row.module !== module) return false;
      if (!term) return true;
      return JSON.stringify({attempt_id:row.attempt_id,module:row.module,test_id:row.test_id,mode:row.mode,mode_label:row.mode_label,responses:(row.responses||[]).map((answer)=>answer.item_id||answer.task_id)}).toLowerCase().includes(term);
    });
  }

  function scoreText(row) {
    if (row.score?.total) return `${row.score.correct}/${row.score.total} (${row.score.percent ?? "—"}%)`;
    if (Number.isFinite(Number(row.completed)) && Number.isFinite(Number(row.total))) return `${row.completed}/${row.total} hoàn thành`;
    return row.status === "in_progress" ? "Đang làm" : "Hoàn thành";
  }

  async function updateSummary() {
    const summary = await AptisAttemptStore.getStorageSummary();
    const totalQuestions = rows.reduce((sum,row)=>sum+Number(row.score?.total||0),0);
    q("#historySummary").innerHTML=`<strong>${rows.length} lượt làm</strong><br><span>${totalQuestions.toLocaleString("vi-VN")} câu · ${summary.assets} assets · ${summary.drafts} drafts</span>`;
    const quota = summary.quota ? `${byteText(summary.usage)} / ${byteText(summary.quota)}` : `${byteText(summary.asset_bytes)} recording assets`;
    q("#storageSummary").innerHTML=`<strong>IndexedDB v2 · Contract ${AptisAttemptStore.contractVersion}</strong><span>${quota}</span><a href="/aptis/contracts/attempt-contract-v2.json">Xem data contract</a>`;
  }

  function render() {
    const visible = filteredRows();
    q("#historyRows").innerHTML = visible.length ? visible.map((row) => `<tr>
      <td>${esc(fmt(row.submitted_at||row.updated_at))}</td>
      <td><span class="badge">${esc(moduleName(row.module))}</span></td>
      <td><strong>${esc(row.mode_label||row.mode||row.test_id||"Bài luyện")}</strong><br><small>${esc(row.test_id||row.attempt_id)}</small></td>
      <td>${esc(scoreText(row))}</td>
      <td>${row.migrated_from_legacy?"Migrated v5":"IndexedDB v2"}${row.synced_to_drive?" · Drive":""}</td>
      <td><div class="row-actions"><button data-review="${esc(row.attempt_id)}">Review</button><button data-json="${esc(row.attempt_id)}">JSON</button><button data-delete="${esc(row.attempt_id)}">Xóa</button></div></td>
    </tr>`).join("") : `<tr><td class="empty" colspan="6">Không có kết quả phù hợp.</td></tr>`;

    document.querySelectorAll("[data-review]").forEach((button)=>button.onclick=()=>openReview(button.dataset.review));
    document.querySelectorAll("[data-json]").forEach((button)=>button.onclick=()=>{const row=rows.find((item)=>item.attempt_id===button.dataset.json);if(row)downloadJson(row,`aptis-${row.module}-${row.attempt_id}.json`);});
    document.querySelectorAll("[data-delete]").forEach((button)=>button.onclick=async()=>{const id=button.dataset.delete;if(!confirm("Xóa attempt và toàn bộ asset liên quan khỏi thiết bị?"))return;await AptisAttemptStore.deleteAttempt(id);await load();});
    updateSummary().catch(console.error);
  }

  function responseCard(response, index) {
    const correct = response.is_correct === true;
    const wrong = response.is_correct === false;
    const title = response.question || response.prompt || response.item_id || response.task_id || `Response ${index+1}`;
    const body = response.text || response.response || response.note || "";
    return `<article class="review-card ${correct?"correct":wrong?"wrong":""}"><small>${esc(response.item_id||response.task_id||`#${index+1}`)}${response.part?` · Part ${esc(response.part)}`:""}</small><h3>${esc(title)}</h3>${body?`<p class="response-text">${esc(body)}</p>`:""}${response.user_label||response.correct_label?`<p>Bạn chọn: <strong>${esc(response.user_label||"Chưa trả lời")}</strong> · Đáp án: <strong>${esc(response.correct_label||response.correct||"—")}</strong></p>`:""}${response.explanation_vi?`<p>${esc(response.explanation_vi)}</p>`:""}</article>`;
  }

  async function speakingAssets(row) {
    const assets = await AptisAttemptStore.listAssets(row.attempt_id);
    if (!assets.length) return `<p class="empty-card">Không tìm thấy recording cho attempt này.</p>`;
    return assets.map((asset)=>{
      const url=asset.blob?URL.createObjectURL(asset.blob):"";if(url)objectUrls.add(url);
      return `<article class="review-card"><small>${esc(asset.task_id||asset.asset_id)}</small><h3>Speaking recording</h3>${url?`<audio controls src="${url}"></audio><a class="download-link" href="${url}" download="${esc(asset.task_id||asset.asset_id)}.${asset.mime_type?.includes("mp4")?"m4a":asset.mime_type?.includes("ogg")?"ogg":"webm"}">Tải recording</a>`:"<p>Asset không có Blob.</p>"}<button data-delete-asset="${esc(asset.asset_id)}">Xóa recording</button></article>`;
    }).join("");
  }

  async function openReview(attemptId) {
    objectUrls.forEach((url)=>URL.revokeObjectURL(url)); objectUrls.clear();
    const row = rows.find((item)=>item.attempt_id===attemptId); if(!row)return;
    q("#reviewTitle").textContent=`${moduleName(row.module)} · ${row.test_id||row.mode_label}`;
    let body=`<section class="attempt-meta"><span>${esc(row.attempt_id)}</span><span>${esc(fmt(row.submitted_at||row.updated_at))}</span><span>${esc(scoreText(row))}</span><span>${esc(row.status)}</span></section>`;
    if(row.module==="speaking") body+=await speakingAssets(row);
    const responses=row.responses||row.answers||[];
    if(row.module==="writing") {
      body+=responses.map((task,index)=>`<article class="review-card"><small>${esc(task.task_id||`Part ${task.part||index+1}`)}</small><h3>Part ${esc(task.part||index+1)}</h3>${(task.responses||[]).map((item)=>`<div class="writing-response"><p>${esc(item.text||"")}</p><small>${Number(item.word_count||0)} words</small></div>`).join("")}</article>`).join("");
    } else if(row.module!=="speaking") body+=responses.length?responses.map(responseCard).join(""):`<p class="empty-card">Attempt chưa có response chi tiết.</p>`;
    q("#reviewContent").innerHTML=body;
    q("#reviewDialog").showModal();
    document.querySelectorAll("[data-delete-asset]").forEach((button)=>button.onclick=async()=>{if(!confirm("Xóa recording này?"))return;await AptisAttemptStore.deleteAsset(button.dataset.deleteAsset);await openReview(attemptId);await updateSummary();});
  }

  async function load() { await AptisAttemptStore.migrateLegacyHistory(); rows=await AptisAttemptStore.listAttempts(); render(); }

  q("#moduleFilter").addEventListener("change",render);
  q("#historySearch").addEventListener("input",render);
  q("#refreshHistory").onclick=load;
  q("#exportHistory").onclick=async()=>downloadJson(await AptisAttemptStore.exportBackup(),`aptis-backup-${new Date().toISOString().slice(0,10)}.json`);
  q("#importHistory").addEventListener("change",async(event)=>{const file=event.target.files?.[0];if(!file)return;try{const result=await AptisAttemptStore.importBackup(JSON.parse(await file.text()));alert(`Đã import ${result.attempts} attempts và ${result.drafts} drafts.`);await load();}catch(error){alert(`Không thể import: ${error.message}`);}event.target.value="";});
  q("#reviewDialog").addEventListener("close",()=>{objectUrls.forEach((url)=>URL.revokeObjectURL(url));objectUrls.clear();});
  document.addEventListener("aptis:history-synced",load);
  load().catch((error)=>{console.error(error);q("#historyRows").innerHTML=`<tr><td class="empty" colspan="6">Không thể tải lịch sử: ${esc(error.message||error)}</td></tr>`;});
})();
