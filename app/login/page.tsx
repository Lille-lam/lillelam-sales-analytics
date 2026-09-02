"use client";
import { FormEvent, useState } from "react";

export default function Login() {
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  async function submit(e:FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const r=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
    if(r.ok) location.href="/";
    else { setError("Wrong password."); setLoading(false); }
  }

  return <main className="loginWrap">
    <form className="loginCard" onSubmit={submit}>
      <div className="brandMark">L</div>
      <h1>Lillelam Sales Analytics</h1>
      <p>Enter the dashboard password.</p>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" autoFocus />
      <button disabled={loading}>{loading?"Opening…":"Open dashboard"}</button>
      {error && <div className="error">{error}</div>}
    </form>
  </main>
}
