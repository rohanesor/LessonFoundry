"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--color-bg)",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 480,
          width: "100%",
          padding: 32,
          textAlign: "center",
          gap: 16,
        }}
      >
        <div className="kicker">LessonFoundry</div>
        <h2 style={{ margin: 0 }}>Something went wrong</h2>
        <p className="muted" style={{ margin: "4px 0 16px" }}>
          {error?.message || "An unexpected error occurred while loading this page."}
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
