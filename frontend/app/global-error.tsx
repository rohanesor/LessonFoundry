"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#f3f2f2",
            fontFamily: "Archivo, system-ui, sans-serif",
            color: "#191f2b",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 32,
              background: "#ffffff",
              border: "1px solid #d7d3d3",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#2763ae",
                marginBottom: 8,
              }}
            >
              LessonFoundry
            </div>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>Application Error</h2>
            <p style={{ margin: "0 0 20px", color: "#605d5d", fontSize: 14 }}>
              {error?.message || "A critical error occurred while loading LessonFoundry."}
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: "#2763ae",
                color: "#ffffff",
                border: "none",
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
