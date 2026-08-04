(() => {
  "use strict";
  const CHANNEL = "aptis-attempt-locks-v1";
  const HEARTBEAT_MS = 3000;
  const STALE_MS = 9000;
  const tabId = crypto.randomUUID?.() || `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  const locks = new Map();
  let active = null;
  let timer = null;
  const now = () => Date.now();
  const publish = (message) => channel?.postMessage({ ...message, tab_id: tabId, sent_at: now() });
  function cleanup(){ for(const [id,row] of locks){ if(now()-row.sent_at>STALE_MS) locks.delete(id); } }
  function conflict(attemptId){ cleanup(); const row=locks.get(attemptId); return row && row.tab_id!==tabId ? row : null; }
  function heartbeat(){ if(active) publish({type:"claim",attempt_id:active.attempt_id,module:active.module}); }
  function claim(attemptId,module){
    if(!attemptId) return {ok:true};
    const other=conflict(attemptId);
    if(other) return {ok:false,owner:other};
    active={attempt_id:attemptId,module};
    locks.set(attemptId,{tab_id:tabId,module,sent_at:now()});
    publish({type:"claim",attempt_id:attemptId,module});
    clearInterval(timer); timer=setInterval(heartbeat,HEARTBEAT_MS);
    return {ok:true};
  }
  function release(){
    if(!active) return;
    publish({type:"release",attempt_id:active.attempt_id,module:active.module});
    locks.delete(active.attempt_id); active=null; clearInterval(timer); timer=null;
  }
  channel?.addEventListener("message",event=>{
    const m=event.data||{}; if(!m.attempt_id||m.tab_id===tabId) return;
    if(m.type==="release") locks.delete(m.attempt_id);
    if(m.type==="claim") locks.set(m.attempt_id,{tab_id:m.tab_id,module:m.module,sent_at:m.sent_at||now()});
    if(active?.attempt_id===m.attempt_id && m.type==="claim") document.dispatchEvent(new CustomEvent("aptis:lock-conflict",{detail:m}));
  });
  window.addEventListener("beforeunload",release);
  window.AptisTabLock=Object.freeze({tabId,claim,release,conflict});
})();
