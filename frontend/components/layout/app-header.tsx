"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LessonFoundryLogo } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
export function AppHeader({ role, crumbs = [], actions }: { role: "Teacher" | "Student"; crumbs?: { label: string; href?: string }[]; actions?: React.ReactNode }) {
  const router = useRouter(); const [error, setError] = useState("");
  return <><header className="app-header">
    <Link href={role === "Teacher" ? "/teacher" : "/student"} className="brand-link" aria-label={`${role} home`}><LessonFoundryLogo height={22} /></Link>
    <nav aria-label="Breadcrumb" className="app-breadcrumb"><Link href={role === "Teacher" ? "/teacher" : "/student"}>Home</Link>{crumbs.map((c,i) => <span key={i}> / {c.href ? <Link href={c.href}>{c.label}</Link> : <b aria-current="page">{c.label}</b>}</span>)}</nav>
    <div className="app-header-actions">{actions}<span className="role-pill">{role}</span><Button variant="ghost" onClick={async () => { try { await signOut(); router.replace("/login"); } catch(e) { setError((e as Error).message); } }}>Sign out</Button></div>
  </header>{error && <div role="alert" className="alert">{error}</div>}</>;
}
