(() => {
  "use strict";
  const module=document.body.dataset.aptisModule||location.pathname.split("/").filter(Boolean).pop();
  const params=new URLSearchParams(location.search);
  const resource=params.get("resume")||params.get("draft");
  if(!resource||!window.AptisTabLock)return;
  const result=AptisTabLock.claim(resource,module);
  if(result.ok)return;
  const banner=document.createElement("div");banner.className="aptis-lock-warning";banner.innerHTML="<strong>Phiên này đang mở ở tab khác.</strong><span>Tab hiện tại được chuyển sang chế độ chỉ xem để tránh ghi đè dữ liệu.</span>";document.body.prepend(banner);
  document.querySelectorAll("button,input,textarea,select").forEach(element=>{if(!element.closest("header"))element.disabled=true;});
  document.dispatchEvent(new CustomEvent("aptis:readonly-conflict",{detail:{resource,module}}));
})();
