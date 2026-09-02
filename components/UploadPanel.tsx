"use client";
import { useState } from "react";

export default function UploadPanel({uploads,onChanged}:{uploads:any[],onChanged:()=>void}) {
  const [open,setOpen]=useState(false);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [file,setFile]=useState<File|null>(null);
  const [pw,setPw]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);

  async function upload() {
    if(!file) return setStatus("Choose an Excel file.");
    setBusy(true); setStatus("");
    const fd=new FormData(); fd.set("file",file); fd.set("report_date",date); fd.set("admin_password",pw);
    const r=await fetch("/api/upload",{method:"POST",body:fd});
    const j=await r.json();
    setBusy(false);
    if(!r.ok) return setStatus(j.error||"Import failed");
    setStatus(`Imported ${j.rows} rows.`);
    setFile(null); onChanged();
  }

  async function remove(id:string) {
    if(!confirm("Delete this imported report and all its rows?")) return;
    const r=await fetch("/api/delete-upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({upload_id:id,admin_password:pw})});
    const j=await r.json();
    if(!r.ok) return setStatus(j.error||"Delete failed");
    setStatus("Report deleted."); onChanged();
  }

  return <div className="adminBox">
    <button className="secondary" onClick={()=>setOpen(!open)}>{open?"Close admin":"Admin / Import"}</button>
    {open && <div className="adminInner">
      <h3>Daily Odoo import</h3>
      <label>Report date<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
      <label>Excel report<input type="file" accept=".xlsx,.xls" onChange={e=>setFile(e.target.files?.[0]||null)} /></label>
      <label>Admin password<input type="password" value={pw} onChange={e=>setPw(e.target.value)} /></label>
      <button onClick={upload} disabled={busy}>{busy?"Importing…":"Import report"}</button>
      {status && <div className="status">{status}</div>}
      <div className="uploadList">
        {uploads.slice(0,12).map(u=><div className="uploadItem" key={u.upload_id}>
          <span><b>{u.report_date}</b><small>{u.source_file}</small></span>
          <button className="dangerLink" onClick={()=>remove(u.upload_id)}>Delete</button>
        </div>)}
      </div>
    </div>}
  </div>;
}
