(() => {
  "use strict";
  const nativeFetch = window.fetch.bind(window);
  const json = async (path) => {
    const response = await nativeFetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  };
  const response = (payload) => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
  const uniqueBy = (rows, key) => {
    const map = new Map();
    for (const row of rows || []) map.set(row?.[key], row);
    return [...map.values()].filter(Boolean);
  };
  async function mergeWriting(base) {
    let merged={...base};
    for(const path of ["/aptis/data/writing/r3/index.json","/aptis/data/writing/r4/index.json"]){
      const addon=await json(path),tests=await Promise.all((addon.test_files||[]).map(json));
      merged={...merged,release:addon.release||merged.release,topics:uniqueBy([...(merged.topics||[]),...(addon.topics||[])],"topic_id"),tests:uniqueBy([...(merged.tests||[]),...tests],"test_id")};
    }
    return merged;
  }
  async function mergeSpeaking(base) {
    let merged={...base};
    for(const path of ["/aptis/data/speaking/r3/index.json","/aptis/data/speaking/r4/index.json"]){
      const addon=await json(path),tests=await Promise.all((addon.test_files||[]).map(json));
      merged={...merged,release:addon.release||merged.release,topics:uniqueBy([...(merged.topics||[]),...(addon.topics||[])],"topic_id"),images:uniqueBy([...(merged.images||[]),...(addon.images||[])],"image_id"),tests:uniqueBy([...(merged.tests||[]),...tests],"test_id")};
    }
    return merged;
  }
  async function mergeListening(base) {
    const addon = await json("/aptis/data/listening/r2/index.json");
    const tests = [];
    for (const meta of addon.tests || []) {
      const parts = await Promise.all((meta.task_files || []).map(json));
      const tasks = parts.flat().sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
      const copy = { ...meta };
      delete copy.task_files;
      copy.tasks = tasks;
      tests.push(copy);
    }
    return {
      ...base,
      version: "2.0.0",
      release: addon.release,
      tests: uniqueBy([...(base.tests || []), ...tests], "test_id")
    };
  }
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const path = url.pathname;
    if (!["/aptis/data/writing/bank-v2.json", "/aptis/data/speaking/bank-v2.json", "/aptis/data/listening/bank-v1.json"].includes(path)) {
      return nativeFetch(input, init);
    }
    const original = await nativeFetch(input, init);
    if (!original.ok) return original;
    try {
      const base = await original.clone().json();
      if (path.endsWith("/writing/bank-v2.json")) return response(await mergeWriting(base));
      if (path.endsWith("/speaking/bank-v2.json")) return response(await mergeSpeaking(base));
      return response(await mergeListening(base));
    } catch (error) {
      console.error("Content refresh add-on unavailable; using base bank.", error);
      return original;
    }
  };
})();
