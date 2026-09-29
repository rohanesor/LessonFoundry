"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accessToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/status";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    accessToken().then((t) => {
      if (!t) { router.replace("/login"); return; }
      api<{ role?: string }>("/me")
        .then((u) => {
          if (u.role === "student") router.replace("/student");
          else setOk(true);
        })
        .catch(() => router.replace("/login"));
    });
  }, [router]);
  if (!ok) return <Skeleton />;
  return <>{children}</>;
}
