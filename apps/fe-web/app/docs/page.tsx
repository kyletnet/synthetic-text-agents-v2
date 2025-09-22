"use client";
import { useEffect, useState } from "react";

export default function DocsHome(){
  const [status,setStatus]=useState<any>(null);
  const [busy,setBusy]=useState(false); 
  const [msg,setMsg]=useState("");
  
  useEffect(()=>{ 
    fetch("/api/docs/status").then(r=>r.json()).then(setStatus).catch(()=>{}); 
  },[]);
  
  async function refresh(){
    setBusy(true); setMsg("");
    try{
      const res = await fetch("/api/docs/refresh",{ 
        method:"POST", 
        headers:{ "x-docs-refresh-token": process.env.NEXT_PUBLIC_DOCS_REFRESH_TOKEN || "" }
      });
      const js = await res.json(); 
      setMsg(js.ok? "Refreshed ✅":"Failed ❌: "+js.error);
      setStatus(await (await fetch("/api/docs/status")).json());
    }catch{ 
      setMsg("Failed ❌"); 
    } finally{ 
      setBusy(false); 
    }
  }
  
  const stale = !!status?.stale;
  
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Documentation</h1>
      
      <div className={`rounded-md p-4 ${stale? "bg-yellow-100":"bg-green-100"}`}>
        <div className="flex items-center gap-3">
          <span className="font-medium">{stale? "Docs are stale":"Docs are up to date"}</span>
          {stale && (
            <button 
              onClick={refresh} 
              disabled={busy} 
              className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
            >
              {busy? "Refreshing...":"Refresh Docs"}
            </button>
          )}
        </div>
        {stale && status?.reasons?.length ? (
          <ul className="list-disc ml-6 mt-2 text-sm">
            {status.reasons.slice(0,8).map((r:string,i:number)=><li key={i}>{r}</li>)}
          </ul>
        ): null}
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </div>
      
      <ul className="list-disc ml-6">
        <li><a href="/docs/RUN_LOGS/INDEX.md" className="text-blue-600 hover:underline">Run Logs</a></li>
        <li><a href="/docs/DECISIONS/INDEX.md" className="text-blue-600 hover:underline">Improvement Notes</a></li>
        <li><a href="/docs/EXPERIMENTS/INDEX.md" className="text-blue-600 hover:underline">Experiments</a></li>
      </ul>
    </main>
  );
}