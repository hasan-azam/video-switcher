import React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        padding: 14,
      }}
    >
      {children}
    </div>
  );
}