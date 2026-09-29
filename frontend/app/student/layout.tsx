"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { accessToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/status";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // Legacy share-token routes bypass auth
    if (pathname.match(/^\/student\/[0-9a-f-]{36}$/)) {
      setOk(true);
      return;
    }
    accessToken().then((t) => {
      if (!t) { router.replace("/login"); return; }
      api<{ role?: string }>("/me")
        .then((u) => {
          if (u.role === "teacher") router.replace("/teacher");
          else setOk(true);
        })
        .catch(() => router.replace("/login"));
    });
  }, [router, pathname]);
  if (!ok) return <Skeleton />;
  return <>{children}</>;
}
