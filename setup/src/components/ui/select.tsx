import React from "react";

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        maxWidth: 260,
        minWidth: 0, // ✅ key
        borderRadius: 10,
        padding: "9px 10px",
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.92)",
        outline: "none",
        fontSize: 13,
      }}
    />
  );
}