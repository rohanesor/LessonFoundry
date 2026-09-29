"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LessonFoundryLogo } from "@/components/icons/brand";
export default function OnboardingPage() {
  const router = useRouter(); const [form,setForm]=useState({name:"",institution_type:"school",institution_name:"",grade_level:""}); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const set=(key:string,value:string)=>setForm(x=>({...x,[key]:value}));
  return <main className="onboarding-page"><div className="onboarding-card"><LessonFoundryLogo height={24}/><div className="kicker">First-run setup</div><h1>Tell us about yourself</h1><p className="muted">This helps LessonFoundry label your classrooms and learning packs.</p><form className="stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const me=await api<{role:string}>("/me");await api("/me",{method:"PATCH",body:JSON.stringify({...form,onboarding_completed:true})});router.replace(me.role==="student"?"/student":"/teacher");}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}><label>Full name<input className="input" required minLength={2} value={form.name} onChange={e=>set("name",e.target.value)}/></label><label>Institution type<select className="input" value={form.institution_type} onChange={e=>set("institution_type",e.target.value)}><option value="school">School</option><option value="college">College / University</option><option value="independent">Independent / Coaching</option></select></label><label>Institution name<input className="input" required minLength={3} value={form.institution_name} onChange={e=>set("institution_name",e.target.value)}/></label><label>Grade / level / department<input className="input" required value={form.grade_level} onChange={e=>set("grade_level",e.target.value)}/></label>{error&&<div className="alert" role="alert">{error}</div>}<Button variant="default" disabled={busy}>{busy?"Saving…":"Continue"}</Button></form></div></main>;
}
